from flask import Blueprint, jsonify

try:
    from ..models.user_model import User
    from ..models.driver_model import Driver
    from ..models.trip_model import Trip
    from ..models.vehicle_model import Vehicle
except ImportError:
    from models.user_model import User
    from models.driver_model import Driver
    from models.trip_model import Trip
    from models.vehicle_model import Vehicle

admin_bp = Blueprint('admin_bp', __name__)


@admin_bp.route('/dashboard', methods=['GET'])
def admin_dashboard():
    total_users = User.query.count()
    total_passengers = User.query.filter_by(role='passenger').count()
    total_drivers = Driver.query.count()
    active_trips = Trip.query.filter_by(status='active').count()
    completed_trips = Trip.query.filter_by(status='completed').count()
    sos_alerts = Trip.query.filter_by(is_sos=True).all()
    pending_drivers = Driver.query.filter_by(is_approved=False).all()

    active_vehicles = Vehicle.query.filter_by(is_active=True).all()
    total_revenue = sum(trip.fare for trip in Trip.query.filter_by(
        status='completed').all())

    return jsonify({
        'stats': {
            'total_users': total_users,
            'total_passengers': total_passengers,
            'total_drivers': total_drivers,
            'active_trips': active_trips,
            'completed_trips': completed_trips,
            'sos_alerts_count': len(sos_alerts),
            'pending_drivers_count': len(pending_drivers),
            'total_revenue': total_revenue
        },
        'sos_alerts': [t.to_dict() for t in sos_alerts],
        'active_vehicles': [v.to_dict() for v in active_vehicles],
        'pending_drivers': [{
            'id': driver.id,
            'name': driver.user.name if driver.user else 'Unknown Driver',
            'license_number': driver.license_number,
            'vehicles': [vehicle.to_dict() for vehicle in driver.vehicles]
        } for driver in pending_drivers]
    }), 200
