import json
import re
import time
import uuid
from datetime import datetime, timezone

from flask import Blueprint, Response, jsonify, request, stream_with_context, current_app

try:
    from ..database import db
    from ..models.payment_model import Payment
    from ..models.trip_model import Trip
    from ..models.wallet_model import Wallet
    from ..models.wallet_transaction_model import WalletTransaction
except ImportError:
    from database import db
    from models.payment_model import Payment
    from models.trip_model import Trip
    from models.wallet_model import Wallet
    from models.wallet_transaction_model import WalletTransaction


payment_bp = Blueprint('payment_bp', __name__)

TOPUP_PRESET_AMOUNTS = [10000, 25000, 50000, 100000]
SUPPORTED_TOPUP_METHODS = {
    'MTN': {
        'code': 'MTN',
        'label': 'MTN Mobile Money',
        'account_label': 'MTN number',
        'hint': 'Instant wallet credit in Uganda',
        'placeholder': '0772123456'
    },
    'AIRTEL': {
        'code': 'AIRTEL',
        'label': 'Airtel Money',
        'account_label': 'Airtel number',
        'hint': 'Instant wallet credit in Uganda',
        'placeholder': '0701123456'
    }
}
TOPUP_METHOD_ALIASES = {
    'mtn': 'MTN',
    'mtn mobile money': 'MTN',
    'mobile money (mtn)': 'MTN',
    'mtn mobile': 'MTN',
    'airtel': 'AIRTEL',
    'airtel money': 'AIRTEL',
    'mobile money (airtel)': 'AIRTEL',
    'airtel mobile money': 'AIRTEL'
}
PHONE_REFERENCE_RE = re.compile(r'^\d{9,15}$')


def _as_utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _normalize_topup_method(value):
    normalized = str(value or '').strip().lower()
    method_code = TOPUP_METHOD_ALIASES.get(normalized)
    if method_code:
        return method_code

    if value in SUPPORTED_TOPUP_METHODS:
        return value

    return None


def _sanitize_account_reference(value):
    raw = str(value or '').strip()
    return ''.join(character for character in raw if character.isdigit())


def _serialize_transactions(user_id):
    user_id = int(user_id)
    trips = (
        Trip.query
        .filter_by(passenger_id=user_id)
        .order_by(Trip.created_at.desc())
        .all()
    )
    wallet_transactions = (
        WalletTransaction.query
        .filter_by(user_id=user_id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )

    paid_trips = [
        trip for trip in trips
        if trip.payment and trip.payment.status == 'success'
    ]

    ride_transactions = [{
        'id': f'ride-{trip.id}',
        'type': 'ride',
        'amount': trip.fare,
        'direction': 'debit',
        'title': f'{trip.start_location} -> {trip.end_location}',
        'subtitle': (
            f'{trip.vehicle.driver.user.name if trip.vehicle and trip.vehicle.driver and trip.vehicle.driver.user else "Assigned driver"}'
            + (
                f' - {trip.vehicle.number_plate}'
                if trip.vehicle else ''
            )
        ),
        'trip_id': trip.id,
        'created_at': (
            trip.payment.created_at.isoformat()
            if trip.payment else trip.created_at.isoformat()
        )
    } for trip in paid_trips]

    topup_transactions = [{
        'id': f'topup-{txn.id}',
        'type': 'topup',
        'amount': txn.amount,
        'direction': 'credit',
        'title': 'Wallet Top-Up',
        'subtitle': txn.payment_method,
        'reference': txn.reference,
        'created_at': txn.created_at.isoformat()
    } for txn in wallet_transactions if txn.transaction_type == 'topup']

    transactions = sorted(
        ride_transactions + topup_transactions,
        key=lambda txn: txn['created_at'],
        reverse=True
    )

    return {
        'transactions': transactions,
        'totals': {
            'rides': len(ride_transactions),
            'spent': sum(txn['amount'] for txn in ride_transactions),
            'topups': sum(txn['amount'] for txn in topup_transactions)
        }
    }


def _build_payment_dashboard_payload(user_id):
    user_id = int(user_id)
    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        return None

    history = _serialize_transactions(user_id)
    recent_topup = next(
        (txn for txn in history['transactions'] if txn['type'] == 'topup'),
        None
    )
    updated_at = datetime.now(timezone.utc).isoformat()

    return {
        'wallet': wallet.to_dict(),
        'history': history,
        'recent_transactions': history['transactions'][:6],
        'methods': list(SUPPORTED_TOPUP_METHODS.values()),
        'suggested_amounts': TOPUP_PRESET_AMOUNTS,
        'stats': {
            'balance': wallet.balance,
            'last_topup_amount': recent_topup['amount'] if recent_topup else 0,
            'last_topup_at': recent_topup['created_at'] if recent_topup else None,
            'last_updated': updated_at
        }
    }


@payment_bp.route('/wallet', methods=['GET'])
def get_wallet():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        return jsonify({
            'balance': 0.0,
            'card_number': 'No SmartCard Linked',
            'no_wallet': True
        }), 200

    return jsonify(wallet.to_dict()), 200


@payment_bp.route('/wallet/topup', methods=['POST'])
def topup_wallet():
    data = request.get_json() or {}
    required_fields = ['user_id', 'amount', 'method']

    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        user_id = int(data['user_id'])
        amount = round(float(data['amount']), 2)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid payment request'}), 400

    if amount < 1000:
        return jsonify({'error': 'Top up amount must be at least 1,000 UGX'}), 400
    if amount > 5000000:
        return jsonify({'error': 'Top up amount is above the allowed limit'}), 400

    method_code = _normalize_topup_method(data.get('method'))
    if not method_code:
        return jsonify({
            'error': 'Only MTN Mobile Money and Airtel Money are enabled right now.'
        }), 400

    account_reference = _sanitize_account_reference(
        data.get('account_reference') or data.get('phone_number')
    )
    if not PHONE_REFERENCE_RE.fullmatch(account_reference):
        return jsonify({
            'error': 'Enter a valid mobile money number to continue.'
        }), 400

    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        return jsonify({'error': 'Wallet not found'}), 404

    method = SUPPORTED_TOPUP_METHODS[method_code]
    wallet.balance += amount

    topup_transaction = WalletTransaction(
        user_id=user_id,
        amount=amount,
        transaction_type='topup',
        payment_method=method['label'],
        reference=f'TOPUP_{uuid.uuid4().hex[:10].upper()}'
    )
    db.session.add(topup_transaction)
    db.session.commit()
    current_app.logger.info(f"Wallet top-up successful: User {user_id}, Amount {amount} UGX, Method {method['label']}")

    return jsonify({
        'message': f'{method["label"]} top-up completed successfully.',
        'new_balance': wallet.balance,
        'transaction': {
            **topup_transaction.to_dict(),
            'account_reference': (
                ('*' * max(len(account_reference) - 4, 0)) + account_reference[-4:]
            )
        },
        'receipt': {
            'transaction_reference': topup_transaction.reference,
            'amount_ugx': amount,
            'payment_method': method['label'],
            'account_reference': account_reference,
            'timestamp': topup_transaction.created_at.isoformat(),
            'status': 'success'
        },
        'dashboard': _build_payment_dashboard_payload(user_id)
    }), 200


@payment_bp.route('/pay_trip', methods=['POST'])
def pay_trip():
    data = request.get_json() or {}
    required_fields = ['trip_id', 'user_id']

    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400

    trip = db.get_or_404(Trip, data['trip_id'])
    if trip.passenger_id != int(data['user_id']):
        return jsonify({'error': 'Unauthorized to pay for this trip'}), 403

    if Payment.query.filter_by(trip_id=trip.id, status='success').first():
        return jsonify({'error': 'Trip already paid for'}), 400

    if trip.status not in {'active', 'completed'}:
        return jsonify({
            'error': 'Trip must be active or completed before payment can be captured.'
        }), 400

    wallet = Wallet.query.filter_by(user_id=data['user_id']).first()
    if not wallet:
        return jsonify({'error': 'User Wallet not found'}), 404

    if wallet.balance < trip.fare:
        return jsonify({
            'error': 'Insufficient funds on SmartCard. Please top-up.',
            'required': trip.fare,
            'balance': wallet.balance
        }), 400

    wallet.balance -= trip.fare

    new_payment = Payment(
        trip_id=trip.id,
        amount=trip.fare,
        payment_method='SmartCard_Nol_Equivalent',
        transaction_id=f'TXN_SMART_{trip.id}_{uuid.uuid4().hex[:8].upper()}',
        status='success'
    )
    db.session.add(new_payment)
    db.session.add(WalletTransaction(
        user_id=int(data['user_id']),
        trip_id=trip.id,
        amount=trip.fare,
        transaction_type='ride_payment',
        payment_method='SmartCard',
        reference=f'RIDE_{uuid.uuid4().hex[:10].upper()}'
    ))

    if trip.status == 'active':
        trip.status = 'completed'
        trip.vehicle.current_passengers = max(
            trip.vehicle.current_passengers - 1, 0
        )
    db.session.commit()
    current_app.logger.info(f"Trip payment successful: Trip {trip.id}, User {data['user_id']}, Fare {trip.fare} UGX")

    return jsonify({
        'message': 'Payment successful via SmartCard',
        'remaining_balance': wallet.balance,
        'payment': new_payment.to_dict(),
        'receipt': {
            'transaction_id': new_payment.transaction_id,
            'amount_ugx': trip.fare,
            'vat_amount_ugx': round(trip.fare * 0.18, 2),
            'service_fee_ugx': round(trip.fare * 0.05, 2),
            'total_paid_ugx': trip.fare,
            'payment_method': 'SmartCard / Mobile Money',
            'timestamp': (
                new_payment.created_at.isoformat()
                if new_payment.created_at else datetime.now(timezone.utc).isoformat()
            ),
            'merchant': 'A Smart Transport System Uganda',
            'support_contact': '+256-414-XXXXXX',
            'tagline': 'Thank you for traveling safely!'
        },
        'dashboard': _build_payment_dashboard_payload(data['user_id'])
    }), 200


@payment_bp.route('/history', methods=['GET'])
def payment_history():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    return jsonify(_serialize_transactions(user_id)), 200


@payment_bp.route('/dashboard', methods=['GET'])
def payment_dashboard():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    payload = _build_payment_dashboard_payload(user_id)
    if not payload:
        return jsonify({'error': 'Wallet not found'}), 404

    return jsonify(payload), 200


@payment_bp.route('/dashboard/stream', methods=['GET'])
def payment_dashboard_stream():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    payload = _build_payment_dashboard_payload(user_id)
    if not payload:
        return jsonify({'error': 'Wallet not found'}), 404

    def event_stream():
        last_payload = None
        last_heartbeat_at = time.monotonic()

        try:
            while True:
                snapshot = _build_payment_dashboard_payload(user_id)
                serialized = json.dumps(snapshot, sort_keys=True)

                if serialized != last_payload:
                    last_payload = serialized
                    yield f'event: dashboard\ndata: {serialized}\n\n'
                    last_heartbeat_at = time.monotonic()
                elif time.monotonic() - last_heartbeat_at >= 15:
                    heartbeat = json.dumps({
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    })
                    yield f'event: heartbeat\ndata: {heartbeat}\n\n'
                    last_heartbeat_at = time.monotonic()

                time.sleep(3)
        except GeneratorExit:
            return

    return Response(
        stream_with_context(event_stream()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )
