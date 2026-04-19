
# --- Imports and Blueprint creation must come first ---
from datetime import datetime, timezone
import time
import json
from flask import Blueprint, Response, jsonify, request, stream_with_context, current_app
import re

try:
    from ..models.user_model import User
    from ..models.driver_model import Driver
    from ..models.trip_model import Trip
    from ..models.trip_log_model import TripLog
    from ..models.vehicle_model import Vehicle
    from ..database import db
except ImportError:
    from models.user_model import User
    from models.driver_model import Driver
    from models.trip_model import Trip
    from models.trip_log_model import TripLog
    from models.vehicle_model import Vehicle
    from database import db

admin_bp = Blueprint('admin_bp', __name__)

# Password requirements (reuse from user_routes if needed)
PASSWORD_SPECIAL_CHAR_RE = re.compile(r'[^A-Za-z0-9]')
PASSWORD_REQUIREMENTS = (
    "Password must be at least 8 characters, "
    "contain a number, a lowercase, an uppercase letter, and a special character."
)

def evaluate_password_strength(password):
    value = str(password or '')
    return (
        len(value) >= 8 and
        any(c.islower() for c in value) and
        any(c.isupper() for c in value) and
        any(c.isdigit() for c in value) and
        PASSWORD_SPECIAL_CHAR_RE.search(value)
    )

@admin_bp.route('/register', methods=['POST'])
def admin_register():
    data = request.get_json()
    if not all(k in data for k in ('name', 'email', 'password')):
        return jsonify({'error': 'Missing required fields'}), 400
    if not evaluate_password_strength(data['password']):
        return jsonify({'error': PASSWORD_REQUIREMENTS}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    admin = User(
        name=data['name'],
        email=data['email'],
        phone=data.get('phone', '0700000000'),
        password=data['password'],
        role='admin'
    )
    db.session.add(admin)
    db.session.commit()
    current_app.logger.info(f"New admin registered: {admin.email}")
    return jsonify({'message': 'Admin registered successfully'}), 201

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    if not all(k in data for k in ('email', 'password')):
        return jsonify({'error': 'Missing email or password'}), 400
    admin = User.query.filter_by(email=data['email'], role='admin').first()
    if not admin or not admin.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    # In production, return a JWT or session token
    return jsonify({'message': 'Login successful', 'admin': admin.to_dict()}), 200


def _get_admin_dashboard_payload():
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

    # PLATFORM REFLEX: Fetch 20 most recent interaction logs
    recent_logs = TripLog.query.order_by(TripLog.created_at.desc()).limit(20).all()

    # Fetch 10 most recent trips (requests + active)
    live_trips = Trip.query.order_by(Trip.created_at.desc()).limit(10).all()

    return {
        'stats': {
            'total_users': total_users,
            'total_passengers': total_passengers,
            'total_drivers': total_drivers,
            'active_trips': active_trips,
            'completed_trips': completed_trips,
            'sos_alerts_count': len(sos_alerts),
            'pending_drivers_count': len(pending_drivers),
            'total_revenue': total_revenue,
            'streamed_at': datetime.now(timezone.utc).isoformat()
        },
        'sos_alerts': [t.to_dict() for t in sos_alerts],
        'active_vehicles': [v.to_dict() for v in active_vehicles],
        'live_trips': [t.to_dict() for t in live_trips],
        'recent_logs': [log.to_dict() for log in recent_logs],
        'pending_drivers': [{
            'id': driver.id,
            'name': driver.user.name if driver.user else 'Unknown Driver',
            'license_number': driver.license_number,
            'vehicles': [vehicle.to_dict() for vehicle in driver.vehicles],
            'created_at': (driver.user.created_at.isoformat() if (driver.user and getattr(driver.user, 'created_at', None)) else datetime.now(timezone.utc).isoformat())
        } for driver in pending_drivers]
    }


@admin_bp.route('/dashboard', methods=['GET'])
def admin_dashboard():
    """REQ-19: Real-time dashboard with platform metrics."""
    payload = _get_admin_dashboard_payload()
    current_app.logger.info("Admin dashboard stats retrieved")
    return jsonify(payload), 200


@admin_bp.route('/dashboard/stream', methods=['GET'])
def admin_dashboard_stream():
    """Real-time SSE stream for Admin Dashboard."""
    def event_stream():
        # Send an immediate connection confirmation to trigger the 'Green' state
        yield f'event: connected\ndata: {json.dumps({"status": "ready", "at": datetime.now(timezone.utc).isoformat()})}\n\n'
        
        last_payload = None
        last_heartbeat_at = time.monotonic()

        try:
            while True:
                # Get current state
                payload = _get_admin_dashboard_payload()
                # Create a version without the changing timestamp for comparison
                comparable_payload = payload.copy()
                if 'stats' in comparable_payload:
                    stats_copy = comparable_payload['stats'].copy()
                    stats_copy.pop('streamed_at', None)
                    comparable_payload['stats'] = stats_copy
                
                serialized = json.dumps(comparable_payload, sort_keys=True)

                # Only push if data has actually changed or 15s have passed (heartbeat)
                if serialized != last_payload:
                    last_payload = serialized
                    yield f'event: dashboard\ndata: {json.dumps(payload)}\n\n'
                    last_heartbeat_at = time.monotonic()
                elif time.monotonic() - last_heartbeat_at >= 15:
                    heartbeat = json.dumps({
                        'streamed_at': datetime.now(timezone.utc).isoformat(),
                        'type': 'heartbeat'
                    })
                    yield f'event: heartbeat\ndata: {heartbeat}\n\n'
                    last_heartbeat_at = time.monotonic()

                time.sleep(3) # check every 3 seconds
        except GeneratorExit:
            return

    return Response(
        stream_with_context(event_stream()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked'
        }
    )


@admin_bp.route('/reports', methods=['GET'])
def generate_reports():
    """Satisfies REQ-20: Generate financial and operational reports."""
    all_trips = Trip.query.all()
    completed = [t for t in all_trips if t.status == 'completed']

    # Financial Summary
    total_revenue = sum(t.fare for t in completed)
    avg_fare = total_revenue / len(completed) if completed else 0

    # Operational Metrics
    by_vehicle_type = {}
    for t in completed:
        v_type = t.vehicle.vehicle_type if t.vehicle else 'Unknown'
        by_vehicle_type[v_type] = by_vehicle_type.get(v_type, 0) + 1

    return jsonify({
        'report_type': 'Global Operational Summary',
        'generated_at': datetime.now().isoformat(),
        'financials': {
            'total_revenue_ugx': total_revenue,
            'average_trip_fare': round(avg_fare, 2),
            'currency': 'UGX'
        },
        'operations': {
            'total_trips_attempted': len(all_trips),
            'total_trips_completed': len(completed),
            'completion_rate': f"{len(completed)/len(all_trips)*100 if all_trips else 0:.1f}%",
            'popular_vehicle_types': by_vehicle_type
        }
    }), 200


@admin_bp.route('/drivers/<int:driver_id>/approve', methods=['POST'])
def approve_driver(driver_id):
    """REQ-26: Admin approves a driver after KYC verification."""
    driver = db.session.get(Driver, driver_id)
    if not driver:
        return jsonify({'error': 'Driver not found'}), 404

    driver.is_approved = True
    db.session.commit()
    current_app.logger.info(f"Driver approved: {driver.user.name if driver.user else driver_id} by admin")

    return jsonify({
        'message': f'Driver {driver.user.name if driver.user else driver_id} has been approved.',
        'driver': driver.to_dict()
    }), 200


@admin_bp.route('/drivers/<int:driver_id>/reject', methods=['POST'])
def reject_driver(driver_id):
    """REQ-26: Admin rejects a driver application."""
    driver = db.session.get(Driver, driver_id)
    if not driver:
        return jsonify({'error': 'Driver not found'}), 404

    # Remove the driver, vehicle, and user records
    for vehicle in driver.vehicles:
        db.session.delete(vehicle)
    user = driver.user
    db.session.delete(driver)
    if user:
        db.session.delete(user)
    db.session.commit()
    current_app.logger.info(f"Driver application rejected and removed: {driver_id}")

    return jsonify({
        'message': 'Driver application has been rejected and removed.'
    }), 200

@admin_bp.route('/system/reset-activity', methods=['POST'])
def reset_system_activity():
    """Clean all trip and payment logs for a fresh platform start."""
    try:
        from ..models.payment_model import Payment
    except ImportError:
        from models.payment_model import Payment
        
    Trip.query.delete()
    Payment.query.delete()
    db.session.commit()
    
    current_app.logger.warning("System activity logs purged by admin.")
    return jsonify({'message': 'System activity logs have been cleared successfully.'}), 200
