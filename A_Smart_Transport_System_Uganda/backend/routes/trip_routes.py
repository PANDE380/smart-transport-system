from datetime import datetime
import uuid
import os
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, current_app

try:
    from ..models.payment_model import Payment
    from ..models.trip_model import Trip
    from ..models.trip_log_model import TripLog
    from ..models.vehicle_model import Vehicle
    from ..models.wallet_model import Wallet
    from ..models.wallet_transaction_model import WalletTransaction
    from ..database import db
except ImportError:
    from models.payment_model import Payment
    from models.trip_model import Trip
    from models.trip_log_model import TripLog
    from models.vehicle_model import Vehicle
    from models.wallet_model import Wallet
    from models.wallet_transaction_model import WalletTransaction
    from database import db

trip_bp = Blueprint('trip_routes', __name__)


def _get_predict_fare():
    try:
        from ..ai.fare_prediction import predict_fare
    except ImportError:
        from ai.fare_prediction import predict_fare

    return predict_fare


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
    predict_fare = _get_predict_fare()
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
    db.session.flush() # Get ID for log

    # PLATFORM REFLEX: Log booking interaction
    log_msg = f"Passenger {new_trip.passenger.name} requested a {new_trip.vehicle.vehicle_type} ride to {new_trip.end_location}."
    db.session.add(TripLog(trip_id=new_trip.id, event_type='REQUEST', message=log_msg))
    
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
    data = request.get_json(silent=True) or {}
    driver_user_id = data.get('driver_user_id')
    
    trip = db.get_or_404(Trip, trip_id)
    if trip.status not in {'pending', 'scheduled'}:
        return jsonify({'error': 'Trip is not awaiting approval'}), 400

    # Claiming logic: If a different driver approves, reassign the vehicle
    target_vehicle = trip.vehicle
    if driver_user_id:
        # We use the relationship to get the User model via Trip -> Passenger -> __class__ ? 
        # Better: just import User at the top or locally.
        try:
            from ..models.user_model import User
        except ImportError:
            from models.user_model import User
            
        driver_user = db.session.get(User, driver_user_id)
        if driver_user and driver_user.driver_profile:
            # Match by vehicle type
            desired_type = trip.vehicle.vehicle_type
            new_vehicle = next((v for v in driver_user.driver_profile.vehicles 
                              if v.vehicle_type == desired_type and v.is_active), None)
            if new_vehicle:
                target_vehicle = new_vehicle
                trip.vehicle_id = new_vehicle.id

    if target_vehicle.current_passengers >= target_vehicle.capacity:
        return jsonify({'error': 'Vehicle is full'}), 400

    trip.status = 'active'
    target_vehicle.current_passengers += 1
    
    # PLATFORM REFLEX: Log approval interaction
    log_msg = f"Driver {target_vehicle.driver.user.name} accepted the trip request to {trip.end_location} (Vehicle: {target_vehicle.number_plate})."
    db.session.add(TripLog(trip_id=trip.id, event_type='APPROVAL', message=log_msg))

    db.session.commit()
    current_app.logger.info(f"Trip {trip.id} approved by Driver")

    return jsonify({
        'message': 'Trip approved and started!',
        'trip': trip.to_dict()
    }), 200


@trip_bp.route('/<int:trip_id>/complete', methods=['POST'])
def complete_trip(trip_id):
    trip = db.get_or_404(Trip, trip_id)
    passenger_name = trip.passenger.name if trip.passenger else "Passenger"
    driver_name = trip.vehicle.driver.user.name if (trip.vehicle and trip.vehicle.driver and trip.vehicle.driver.user) else "Driver"
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

    # PLATFORM REFLEX: Log completion interaction
    log_msg = f"Trip completed successfully. {driver_name} dropped off {passenger_name} at {trip.end_location}."
    db.session.add(TripLog(trip_id=trip.id, event_type='COMPLETION', message=log_msg))

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
    if trip.status not in {'pending', 'scheduled'}:
        return jsonify({'error': 'Trip is not pending approval'}), 400

    trip.status = 'cancelled'
    
    # PLATFORM REFLEX: Log rejection interaction
    actor = "Driver" # Usually driver rejects pending
    log_msg = f"{actor} declined the trip request to {trip.end_location}."
    db.session.add(TripLog(trip_id=trip.id, event_type='REJECTION', message=log_msg))

    db.session.commit()

    return jsonify({
        'message': 'Trip request rejected.',
        'trip': trip.to_dict()
    }), 200


@trip_bp.route('/<int:trip_id>/sos', methods=['POST'])
def trigger_sos(trip_id):
    trip = db.get_or_404(Trip, trip_id)
    trip.is_sos = True
    
    # Process forensic evidence if provided
    evidence_desc = request.form.get('description', '').strip()
    if evidence_desc:
        trip.sos_description = evidence_desc
        
    if 'evidence_photo' in request.files:
        photo = request.files['evidence_photo']
        if photo and photo.filename:
            filename = secure_filename(f"sos_{trip_id}_{uuid.uuid4().hex[:8]}_{photo.filename}")
            upload_folder = os.path.join(current_app.static_folder, 'evidence')
            os.makedirs(upload_folder, exist_ok=True)
            photo_path = os.path.join(upload_folder, filename)
            photo.save(photo_path)
            trip.sos_evidence_url = f"/static/evidence/{filename}"

    # PLATFORM REFLEX: Log SOS interaction
    log_msg = f"🚨 SOS ALERT triggered by Passenger {trip.passenger.name} for ride to {trip.end_location}!"
    db.session.add(TripLog(trip_id=trip.id, event_type='SOS', message=log_msg))

    db.session.commit()
    
    current_app.logger.warning(f"SOS triggered for Trip #{trip_id}. Evidence Photo: {trip.sos_evidence_url}")
    return jsonify({
        'message': 'SOS Alert triggered! Authorities and Admin have been notified.',
        'trip_id': trip_id,
        'evidence_logged': bool(trip.sos_evidence_url or trip.sos_description)
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
    
    # PLATFORM REFLEX: Log rating interaction
    log_msg = f"Passenger {trip.passenger.name} rated the experience {rating_val} stars."
    db.session.add(TripLog(trip_id=trip.id, event_type='RATE', message=log_msg))

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
