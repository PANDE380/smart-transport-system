from flask import Blueprint, request, jsonify

try:
    from ..models.trip_model import Trip
    from ..models.vehicle_model import Vehicle
    from ..models.wallet_model import Wallet
    from ..database import db
    from ..ai.fare_prediction import predict_fare
except ImportError:
    from models.trip_model import Trip
    from models.vehicle_model import Vehicle
    from models.wallet_model import Wallet
    from database import db
    from ai.fare_prediction import predict_fare

trip_bp = Blueprint('trip_routes', __name__)


@trip_bp.route('/estimate-fare', methods=['POST'])
def estimate_fare():
    data = request.get_json()
    if 'distance_km' not in data:
        return jsonify({'error': 'distance_km required'}), 400

    distance = float(data['distance_km'])
    predicted = predict_fare(distance)

    return jsonify({
        'distance_km': distance,
        'estimated_fare_ugx': predicted
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

    # Start trip as pending, awaiting driver approval
    new_trip = Trip(
        passenger_id=data['passenger_id'],
        vehicle_id=data['vehicle_id'],
        start_location=data['start_location'],
        end_location=data['end_location'],
        fare=data['fare'],
        status='pending'
    )

    db.session.add(new_trip)
    db.session.commit()

    return jsonify({
        'message': 'Trip request sent! Please wait for driver approval.',
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

    return jsonify({
        'message': 'Trip approved and started!',
        'trip': trip.to_dict()
    }), 200


@trip_bp.route('/<int:trip_id>/complete', methods=['POST'])
def complete_trip(trip_id):
    trip = db.get_or_404(Trip, trip_id)
    if trip.status != 'active':
        return jsonify({'error': 'Trip is not currently active'}), 400

    vehicle = trip.vehicle
    if vehicle and vehicle.current_passengers > 0:
        vehicle.current_passengers -= 1

    trip.status = 'completed'

    # Deduct passenger fare
    passenger_wallet = Wallet.query.filter_by(user_id=trip.passenger_id).first()
    if passenger_wallet:
        passenger_wallet.balance -= trip.fare

    db.session.commit()

    return jsonify({
        'message': 'Trip completed and passenger charged.',
        'trip': trip.to_dict()
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
        return jsonify({'error': 'Rating is required'}), 400

    trip.rating = data['rating']
    trip.feedback = data.get('feedback', '')
    db.session.commit()

    return jsonify({
        'message': 'Thank you for your feedback!',
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
