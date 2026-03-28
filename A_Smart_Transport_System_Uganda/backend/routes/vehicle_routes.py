from flask import Blueprint, request, jsonify

try:
    from ..models.vehicle_model import Vehicle
    from ..models.trip_model import Trip
    from ..database import db
except ImportError:
    from models.vehicle_model import Vehicle
    from models.trip_model import Trip
    from database import db

vehicle_bp = Blueprint('vehicle_bp', __name__)


@vehicle_bp.route('/live-locations', methods=['GET'])
def get_live_locations():
    """
    Returns active vehicles and trips in progress for live map tracking.
    """
    vehicles = Vehicle.query.filter_by(is_active=True).all()
    # For simulation, we also fetch active trips for passenger locations
    active_trips = Trip.query.filter_by(status='active').all()

    return jsonify({
        'vehicles': [v.to_dict() for v in vehicles],
        'trips': [t.to_dict() for t in active_trips]
    }), 200


@vehicle_bp.route('/active', methods=['GET'])
def get_active_vehicles():
    """
    Get all active vehicles, optionally filtered by type (e.g., ?type=Taxi)
    """
    v_type = request.args.get('type')

    query = Vehicle.query.filter_by(is_active=True)
    if v_type:
        query = query.filter_by(vehicle_type=v_type)

    vehicles = query.all()
    return jsonify([v.to_dict() for v in vehicles]), 200


@vehicle_bp.route('/<int:vehicle_id>/capacity', methods=['POST'])
def update_capacity(vehicle_id):
    data = request.json
    vehicle = db.get_or_404(Vehicle, vehicle_id)

    if 'current_passengers' in data:
        vehicle.current_passengers = data['current_passengers']
        db.session.commit()

        is_overloaded = vehicle.current_passengers > vehicle.capacity
        return jsonify({
            'message': 'Capacity updated',
            'overloaded': is_overloaded,
            'vehicle': vehicle.to_dict()
        }), 200

    return jsonify({'error': 'Missing current_passengers'}), 400


@vehicle_bp.route('/', methods=['POST'])
def register_vehicle():
    data = request.json
    required_fields = ['driver_id', 'number_plate', 'capacity', 'vehicle_type']

    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400

    if Vehicle.query.filter_by(number_plate=data['number_plate']).first():
        return jsonify({
            'error': 'Vehicle with this plate already exists'
        }), 400

    new_vehicle = Vehicle(
        driver_id=data['driver_id'],
        number_plate=data['number_plate'],
        capacity=data['capacity'],
        vehicle_type=data['vehicle_type'],
        is_active=data.get('is_active', False)
    )

    db.session.add(new_vehicle)
    db.session.commit()
    return jsonify({
        'message': 'Vehicle registered successfully',
        'vehicle': new_vehicle.to_dict()
    }), 201
