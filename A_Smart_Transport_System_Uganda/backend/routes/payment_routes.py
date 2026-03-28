from flask import Blueprint, request, jsonify
import uuid

try:
    from ..models.payment_model import Payment
    from ..models.trip_model import Trip
    from ..models.wallet_model import Wallet
    from ..models.wallet_transaction_model import WalletTransaction
    from ..database import db
except ImportError:
    from models.payment_model import Payment
    from models.trip_model import Trip
    from models.wallet_model import Wallet
    from models.wallet_transaction_model import WalletTransaction
    from database import db

payment_bp = Blueprint('payment_bp', __name__)


@payment_bp.route('/wallet', methods=['GET'])
def get_wallet():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    wallet = Wallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        # If it's a driver or admin, they might not have a passenger wallet.
        # Return a graceful 'no wallet' response instead of 404.
        return jsonify({
            'balance': 0.0,
            'card_number': 'No SmartCard Linked',
            'no_wallet': True
        }), 200

    return jsonify(wallet.to_dict()), 200


@payment_bp.route('/wallet/topup', methods=['POST'])
def topup_wallet():
    data = request.json
    # method e.g. 'MTN Mobile Money' // Simulated
    required_fields = ['user_id', 'amount', 'method']

    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400

    amount = float(data['amount'])
    if amount <= 0:
        return jsonify({'error': 'Top up amount must be positive'}), 400

    wallet = Wallet.query.filter_by(user_id=data['user_id']).first()
    if not wallet:
        return jsonify({'error': 'Wallet not found'}), 404

    # Mocking actual gateway interaction here
    wallet.balance += amount

    topup_transaction = WalletTransaction(
        user_id=int(data['user_id']),
        amount=amount,
        transaction_type='topup',
        payment_method=data['method'],
        reference=f'TOPUP_{uuid.uuid4().hex[:10].upper()}'
    )
    db.session.add(topup_transaction)
    db.session.commit()

    return jsonify({
        'message': f'Successfully topped up {amount} UGX via {data["method"]}',
        'new_balance': wallet.balance
    }), 200


@payment_bp.route('/pay_trip', methods=['POST'])
def pay_trip():
    """Pays for a trip using the SmartCard Wallet"""
    data = request.json
    required_fields = ['trip_id', 'user_id']

    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400

    trip = db.get_or_404(Trip, data['trip_id'])
    if trip.passenger_id != int(data['user_id']):
        return jsonify({'error': 'Unauthorized to pay for this trip'}), 403

    if (trip.status == 'completed' and
            Payment.query.filter_by(
                trip_id=trip.id, status='success').first()):
        return jsonify({'error': 'Trip already paid for'}), 400

    wallet = Wallet.query.filter_by(user_id=data['user_id']).first()
    if not wallet:
        return jsonify({'error': 'User Wallet not found'}), 404

    if wallet.balance < trip.fare:
        return jsonify({
            'error': 'Insufficient funds on SmartCard. Please top-up.',
            'required': trip.fare,
            'balance': wallet.balance
        }), 400

    # Execute Payment
    wallet.balance -= trip.fare

    new_payment = Payment(
        trip_id=trip.id,
        amount=trip.fare,
        payment_method='SmartCard_Nol_Equivalent',
        transaction_id=f'TXN_SMART_{trip.id}_{wallet.id}',
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

    trip.status = 'completed'
    if trip.vehicle and trip.vehicle.current_passengers:
        trip.vehicle.current_passengers = max(
            trip.vehicle.current_passengers - 1, 0
        )
    db.session.commit()

    return jsonify({
        'message': 'Payment successful via SmartCard',
        'remaining_balance': wallet.balance,
        'payment': new_payment.to_dict()
    }), 200


@payment_bp.route('/history', methods=['GET'])
def payment_history():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

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

    ride_transactions = [{
        'id': f'ride-{trip.id}',
        'type': 'ride',
        'amount': trip.fare,
        'direction': 'debit',
        'title': f'{trip.start_location} -> {trip.end_location}',
        'subtitle': (
            f'{trip.vehicle.driver.user.name if trip.vehicle and trip.vehicle.driver and trip.vehicle.driver.user else "Assigned driver"}'
            + (
                f' · {trip.vehicle.number_plate}'
                if trip.vehicle else ''
            )
        ),
        'trip_id': trip.id,
        'created_at': (
            trip.payment.created_at.isoformat()
            if trip.payment else trip.created_at.isoformat()
        )
    } for trip in trips]

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

    return jsonify({
        'transactions': transactions,
        'totals': {
            'rides': len(ride_transactions),
            'spent': sum(txn['amount'] for txn in ride_transactions),
            'topups': sum(txn['amount'] for txn in topup_transactions)
        }
    }), 200
