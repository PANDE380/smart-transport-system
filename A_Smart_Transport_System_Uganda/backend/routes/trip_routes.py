from datetime import datetime
import uuid
from flask import Blueprint, request, jsonify, current_app

try:
    from ..models.payment_model import Payment
    from ..models.trip_model import Trip
    from ..models.vehicle_model import Vehicle
    from ..models.wallet_model import Wallet
    from ..models.wallet_transaction_model import WalletTransaction
    from ..database import db
    from ..ai.fare_prediction import predict_fare
except ImportError:
    from models.payment_model import Payment
    from models.trip_model import Trip
    from models.vehicle_model import Vehicle
    from models.wallet_model import Wallet
    from models.wallet_transaction_model import WalletTransaction
    from database import db
    from ai.fare_prediction import predict_fare

trip_bp = Blueprint('trip_routes', __name__)


def build_trip_receipt(payment, trip):
    return {
        'transaction_id': payment.transaction_id,
        'amount_ugx': trip.fare,
        'vat_amount_ugx': round(trip.fare * 0.18, 2),
        'service_fee_ugx': round(trip.fare * 0.05, 2),
        'total_paid_ugx': trip.fare,
        'payment_method': payment.payment_method,
        'timestamp': payment.created_at.isoformat(),
        'merchant': 'A Smart Transport System Uganda',
        'support_contact': '+256-414-XXXXXX',
        'tagline': 'Thank you for traveling safely!'
    }


@trip_bp.route('/estimate-fare', methods=['POST'])
def estimate_fare():
    data = request.get_json()
    if 'distance_km' not in data:
        return jsonify({'error': 'distance_km required'}), 400

    distance = float(data['distance_km'])
    v_type = data.get('vehicle_type', 'Taxi')
    
    # We can also pass traffic_level and weather if the frontend provides it,
    # otherwise predict_fare will simulate them.
    predicted = predict_fare(
        distance_km=distance,
        vehicle_type=v_type,
        traffic_level=data.get('traffic_level'),
        weather=data.get('weather')
    )

    return jsonify({
        'distance_km': distance,
        'estimated_fare_ugx': predicted,
        'vehicle_type': v_type,
        'ai_powered': True
    }), 200


@trip_bp.route('/book', methods=['POST'])
def book_trip():
    data = request.json
    required_fields = ['passenger_id', 'vehicle_id',
                       'start_location', 'end_location', 'fare']

    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields for booking'}), 400

    # basic check
    # Assuming vehicle_id refers to a Vehicle
    vehicle = db.session.get(Vehicle, data['vehicle_id'])
    if not vehicle:
        return jsonify({'error': 'Vehicle not found'}), 404

    if vehicle.current_passengers >= vehicle.capacity:
        return jsonify({'error': 'Vehicle is full'}), 400

    # REQ-28: Scheduled rides
    scheduled_at = None
    trip_status = 'pending'
    if data.get('scheduled_at'):
        try:
            scheduled_at = datetime.fromisoformat(data['scheduled_at'])
            trip_status = 'scheduled'
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid scheduled date/time format'}), 400

    # Start trip as pending or scheduled, awaiting driver approval
    new_trip = Trip(
        passenger_id=data['passenger_id'],
        vehicle_id=data['vehicle_id'],
        start_location=data['start_location'],
        end_location=data['end_location'],
        fare=data['fare'],
        status=trip_status,
        scheduled_at=scheduled_at
    )

    db.session.add(new_trip)
    db.session.commit()
    current_app.logger.info(f"New trip booked: ID {new_trip.id} by Passenger {new_trip.passenger_id}")

    msg = ('Trip scheduled successfully! The driver will be notified closer to '
           'the pickup time.' if trip_status == 'scheduled'
           else 'Trip request sent! Please wait for driver approval.')

    return jsonify({
        'message': msg,
        'trip': new_trip.to_dict()
    }), 201


@trip_bp.route('/<int:trip_id>/approve', methods=['POST'])
def approve_trip(trip_id):
    trip = db.get_or_404(Trip, trip_id)
    if trip.status != 'pending':
        return jsonify({'error': 'Trip is not pending approval'}), 400

    vehicle = trip.vehicle
    if vehicle.current_passengers >= vehicle.capacity:
        return jsonify({'error': 'Vehicle is full'}), 400

    trip.status = 'active'
    vehicle.current_passengers += 1
    db.session.commit()
    current_app.logger.info(f"Trip {trip.id} approved by Driver")

    return jsonify({
        'message': 'Trip approved and started!',
        'trip': trip.to_dict()
    }), 200


@trip_bp.route('/<int:trip_id>/complete', methods=['POST'])
def complete_trip(trip_id):
    trip = db.get_or_404(Trip, trip_id)
    if trip.status != 'active':
        return jsonify({'error': 'Trip is not currently active'}), 400

    payment = Payment.query.filter_by(trip_id=trip.id, status='success').first()
    passenger_wallet = Wallet.query.filter_by(user_id=trip.passenger_id).first()

    if not payment:
        if not passenger_wallet:
            return jsonify({'error': 'Passenger wallet not found'}), 404

        if passenger_wallet.balance < trip.fare:
            return jsonify({
                'error': 'Passenger has insufficient wallet balance to complete this trip.',
                'required': trip.fare,
                'balance': passenger_wallet.balance
            }), 400

        passenger_wallet.balance -= trip.fare

        payment = Payment(
            trip_id=trip.id,
            amount=trip.fare,
            payment_method='SmartCard_Nol_Equivalent',
            transaction_id=f'TXN_SMART_{trip.id}_{uuid.uuid4().hex[:8].upper()}',
            status='success'
        )
        db.session.add(payment)
        db.session.add(WalletTransaction(
            user_id=trip.passenger_id,
            trip_id=trip.id,
            amount=trip.fare,
            transaction_type='ride_payment',
            payment_method='SmartCard',
            reference=f'RIDE_{uuid.uuid4().hex[:10].upper()}'
        ))

    vehicle = trip.vehicle
    if vehicle and vehicle.current_passengers > 0:
        vehicle.current_passengers -= 1

    trip.status = 'completed'

    db.session.commit()
    current_app.logger.info(f"Trip {trip.id} completed. Payment success.")

    return jsonify({
        'message': 'Trip completed and passenger charged.',
        'trip': trip.to_dict(),
        'remaining_balance': passenger_wallet.balance if passenger_wallet else None,
        'payment': payment.to_dict(),
        'receipt': build_trip_receipt(payment, trip)
    }), 200


@trip_bp.route('/<int:trip_id>/reject', methods=['POST'])
def reject_trip(trip_id):
    trip = db.get_or_404(Trip, trip_id)
    if trip.status != 'pending':
        return jsonify({'error': 'Trip is not pending approval'}), 400

    trip.status = 'cancelled'
    db.session.commit()

    return jsonify({
        'message': 'Trip request rejected.',
        'trip': trip.to_dict()
    }), 200


@trip_bp.route('/<int:trip_id>/sos', methods=['POST'])
def trigger_sos(trip_id):
    trip = db.get_or_404(Trip, trip_id)
    trip.is_sos = True
    db.session.commit()
    # In a real system, this would alert security/police
    return jsonify({
        'message': 'SOS Alert triggered! Authorities and Admin have been notified.',
        'trip_id': trip_id
    }), 200


@trip_bp.route('/<int:trip_id>/rate', methods=['POST'])
def rate_trip(trip_id):
    data = request.get_json()
    trip = db.get_or_404(Trip, trip_id)

    if 'rating' not in data:
        return jsonify({'error': 'Rating is required for review'}), 400

    try:
        rating_val = int(data['rating'])
        if not (1 <= rating_val <= 5):
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'Rating must be an integer between 1 and 5 stars'}), 400

    trip.rating = rating_val
    trip.feedback = str(data.get('feedback', '')).strip()
    db.session.commit()

    return jsonify({
        'message': f'Thank you for your {rating_val}-star feedback!',
        'trip_id': trip_id
    }), 200


@trip_bp.route('/history', methods=['GET'])
def get_trip_history():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    trips = (
        Trip.query
        .filter_by(passenger_id=user_id)
        .order_by(Trip.created_at.desc())
        .all()
    )
    return jsonify({
        'trips': [t.to_dict() for t in trips]
    }), 200
