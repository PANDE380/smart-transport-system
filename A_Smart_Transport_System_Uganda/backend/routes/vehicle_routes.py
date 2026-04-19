from datetime import datetime, timezone
import json
import time
from flask import Blueprint, request, jsonify, Response, stream_with_context

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
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'vehicles': [v.to_dict() for v in vehicles],
        'trips': [t.to_dict() for t in active_trips]
    }), 200


@vehicle_bp.route('/live-locations/stream', methods=['GET'])
def get_live_locations_stream():
    """
    SSE endpoint for real-time live map tracking.
    """
    def event_stream():
        last_payload = None
        last_heartbeat_at = time.monotonic()

        import random
        try:
            while True:
                # Use a separate session context if needed, or query safely
                vehicles = Vehicle.query.filter_by(is_active=True).all()
                active_trips = Trip.query.filter(Trip.status.in_(['active', 'pending'])).all()
                
                vehicle_data_list = []
                for v in vehicles:
                    try:
                        # Safe float cast for all numeric fields
                        lat = float(v.current_lat) if v.current_lat is not None else 0.3476
                        lng = float(v.current_lng) if v.current_lng is not None else 32.5825
                        
                        simulated_lat = lat + (random.random() - 0.5) * 0.0005
                        simulated_lng = lng + (random.random() - 0.5) * 0.0005
                        
                        v_dict = v.to_dict()
                        v_dict['current_lat'] = simulated_lat
                        v_dict['current_lng'] = simulated_lng
                        vehicle_data_list.append(v_dict)
                    except (ValueError, TypeError):
                        continue # Skip corrupted record
                
                # Robust serialization using default=str to catch decimals/datetimes
                data_payload = {
                    'vehicles': vehicle_data_list,
                    'active_trips': [t.to_dict() for t in active_trips],
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                
                payload = json.dumps(data_payload, default=str)
                
                if payload != last_payload:
                    yield f"data: {payload}\n\n"
                    last_payload = payload
                
                if time.monotonic() - last_heartbeat_at > 30:
                    yield ": heartbeat\n\n"
                    last_heartbeat_at = time.monotonic()

                time.sleep(1)
        except Exception as e:
            # Fatal error in stream, log for debugging
            with open('stream_debug.log', 'a') as f:
                f.write(f"[{datetime.now()}] CRITICAL: {str(e)}\n")
            return
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
