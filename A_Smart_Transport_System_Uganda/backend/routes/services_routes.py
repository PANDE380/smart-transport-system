import json
import time
from datetime import datetime, timezone

from flask import Blueprint, Response, jsonify, stream_with_context

try:
    from ..models.driver_model import Driver
    from ..models.payment_model import Payment
    from ..models.trip_model import Trip
    from ..models.vehicle_model import Vehicle
    from ..models.wallet_transaction_model import WalletTransaction
    from ..utils.openai_service import get_chatbot_runtime_status
except ImportError:
    from models.driver_model import Driver
    from models.payment_model import Payment
    from models.trip_model import Trip
    from models.vehicle_model import Vehicle
    from models.wallet_transaction_model import WalletTransaction
    from utils.openai_service import get_chatbot_runtime_status


services_bp = Blueprint('services_bp', __name__)


TRANSPORT_SERVICE_TYPES = {
    'standard_taxi': {'Taxi'},
    'boda_boda': {'Boda Boda'},
    'special_hire': {'Special Hire'},
    'mini_bus': {'Mini Bus'},
    'marine_transport': {'Marine'},
    'smart_bus': {'Bus'}
}


def _as_utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _metric(value, label, value_type='number'):
    return {
        'value': value,
        'label': label,
        'type': value_type
    }


def _build_transport_service_payload(service_types, trips, vehicles, today):
    service_vehicles = [
        vehicle for vehicle in vehicles
        if vehicle.vehicle_type in service_types
    ]
    active_vehicles = [vehicle for vehicle in service_vehicles if vehicle.is_active]
    active_trips = [
        trip for trip in trips
        if trip.status == 'active' and
        trip.vehicle and trip.vehicle.vehicle_type in service_types
    ]
    completed_today = [
        trip for trip in trips
        if trip.status == 'completed' and
        trip.vehicle and trip.vehicle.vehicle_type in service_types and
        _as_utc(trip.created_at) and _as_utc(trip.created_at).date() == today
    ]

    status = 'live' if active_vehicles or active_trips else 'standby'
    return {
        'status': status,
        'metrics': [
            _metric(len(active_vehicles), 'vehicles online'),
            _metric(len(active_trips), 'active trips'),
            _metric(len(completed_today), 'completed today')
        ]
    }


def _build_activity_feed(trips, topups):
    feed = []

    for trip in trips[:12]:
        vehicle_type = trip.vehicle.vehicle_type if trip.vehicle else 'Service'
        title = f'{vehicle_type} trip update'
        tone = 'neutral'

        if trip.is_sos:
            title = f'SOS alert on {vehicle_type.lower()} trip'
            tone = 'critical'
        elif trip.status == 'pending':
            title = f'New {vehicle_type.lower()} request'
            tone = 'warning'
        elif trip.status == 'scheduled':
            title = f'{vehicle_type} trip scheduled'
            tone = 'neutral'
        elif trip.status == 'active':
            title = f'{vehicle_type} trip in progress'
            tone = 'good'
        elif trip.status == 'completed':
            title = f'{vehicle_type} trip completed'
            tone = 'good'
        elif trip.status == 'cancelled':
            title = f'{vehicle_type} trip cancelled'
            tone = 'neutral'

        feed.append({
            'id': f'trip-{trip.id}',
            'title': title,
            'detail': f'{trip.start_location} to {trip.end_location}',
            'meta': trip.passenger.name if trip.passenger else 'Passenger activity',
            'tone': tone,
            'created_at': trip.created_at.isoformat() if trip.created_at else None,
            'sort_at': _as_utc(trip.created_at) or datetime.min.replace(tzinfo=timezone.utc)
        })

    for transaction in topups[:8]:
        feed.append({
            'id': f'topup-{transaction.id}',
            'title': 'Wallet top-up received',
            'detail': f'{transaction.payment_method} credited {round(transaction.amount, 2)} UGX',
            'meta': transaction.reference,
            'tone': 'good',
            'created_at': transaction.created_at.isoformat() if transaction.created_at else None,
            'sort_at': _as_utc(transaction.created_at) or datetime.min.replace(tzinfo=timezone.utc)
        })

    feed.sort(key=lambda item: item['sort_at'], reverse=True)

    return [
        {
            key: value
            for key, value in item.items()
            if key != 'sort_at'
        }
        for item in feed[:8]
    ]


def _build_services_dashboard_payload():
    trips = Trip.query.order_by(Trip.created_at.desc()).all()
    vehicles = Vehicle.query.order_by(Vehicle.id.desc()).all()
    drivers = Driver.query.order_by(Driver.id.desc()).all()
    payments = Payment.query.order_by(Payment.created_at.desc()).all()
    wallet_transactions = (
        WalletTransaction.query
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )

    now = datetime.now(timezone.utc)
    today = now.date()
    active_trips = [trip for trip in trips if trip.status == 'active']
    pending_requests = [trip for trip in trips if trip.status == 'pending']
    scheduled_trips = [trip for trip in trips if trip.status == 'scheduled']
    completed_today = [
        trip for trip in trips
        if trip.status == 'completed' and
        _as_utc(trip.created_at) and _as_utc(trip.created_at).date() == today
    ]
    successful_payments = [
        payment for payment in payments
        if payment.status == 'success'
    ]
    successful_payments_today = [
        payment for payment in successful_payments
        if _as_utc(payment.created_at) and _as_utc(payment.created_at).date() == today
    ]
    topups_today = [
        transaction for transaction in wallet_transactions
        if transaction.transaction_type == 'topup' and
        _as_utc(transaction.created_at) and
        _as_utc(transaction.created_at).date() == today
    ]
    ratings = [trip.rating for trip in trips if trip.rating]
    approved_drivers = [driver for driver in drivers if driver.is_approved]
    pending_driver_applications = [
        driver for driver in drivers if not driver.is_approved
    ]
    active_vehicles = [vehicle for vehicle in vehicles if vehicle.is_active]
    sos_alerts = [trip for trip in trips if trip.is_sos]
    open_sos_alerts = [
        trip for trip in sos_alerts
        if trip.status not in {'completed', 'cancelled'}
    ]
    map_points = [
        {
            'id': vehicle.id,
            'lat': vehicle.current_lat,
            'lng': vehicle.current_lng,
            'vehicle_type': vehicle.vehicle_type,
            'number_plate': vehicle.number_plate,
            'driver_name': (
                vehicle.driver.user.name
                if vehicle.driver and vehicle.driver.user else 'Assigned driver'
            ),
            'current_passengers': vehicle.current_passengers,
            'capacity': vehicle.capacity
        }
        for vehicle in active_vehicles
        if vehicle.current_lat is not None and vehicle.current_lng is not None
    ]
    chatbot_status = get_chatbot_runtime_status()
    today_topup_total = round(sum(item.amount for item in topups_today), 2)
    today_revenue = round(
        sum(payment.amount for payment in successful_payments_today), 2
    )

    services = {
        key: _build_transport_service_payload(service_types, trips, vehicles, today)
        for key, service_types in TRANSPORT_SERVICE_TYPES.items()
    }
    services.update({
        'live_vehicle_tracking': {
            'status': 'live' if map_points else 'standby',
            'metrics': [
                _metric(len(map_points), 'mapped vehicles'),
                _metric(len(active_trips), 'trackable trips'),
                _metric(len(active_vehicles), 'active fleet')
            ]
        },
        'emergency_sos': {
            'status': 'attention' if open_sos_alerts else 'ready',
            'metrics': [
                _metric(len(open_sos_alerts), 'open alerts'),
                _metric(len(sos_alerts), 'all alerts'),
                _metric(len(active_trips), 'active trips monitored')
            ]
        },
        'mobile_money_payments': {
            'status': 'live' if topups_today or successful_payments_today else 'ready',
            'metrics': [
                _metric(today_topup_total, 'topups today', 'currency'),
                _metric(len(topups_today), 'wallet credits'),
                _metric(today_revenue, 'ride payments', 'currency')
            ]
        },
        'ai_smart_routing': {
            'status': 'live' if chatbot_status['configured'] else 'setup',
            'metrics': [
                _metric(chatbot_status['provider'], 'assistant provider', 'text'),
                _metric(chatbot_status['model'], 'configured model', 'text'),
                _metric(len(completed_today), 'completed trips today')
            ]
        },
        'ussd_access': {
            'status': 'available',
            'metrics': [
                _metric('*123#', 'dial code', 'text'),
                _metric(len(pending_requests), 'pending requests'),
                _metric(len(active_vehicles), 'vehicles reachable')
            ]
        },
        'verified_driver_matching': {
            'status': 'live' if approved_drivers else 'onboarding',
            'metrics': [
                _metric(len(approved_drivers), 'approved drivers'),
                _metric(len(active_vehicles), 'active vehicles'),
                _metric(len(pending_driver_applications), 'pending approvals')
            ]
        },
        'lost_and_found': {
            'status': 'ready',
            'metrics': [
                _metric(len(completed_today), 'rides completed today'),
                _metric(len(vehicles), 'registered vehicles'),
                _metric(len(pending_requests), 'new requests')
            ]
        },
        'driver_ratings_feedback': {
            'status': 'live' if ratings else 'waiting',
            'metrics': [
                _metric(round(sum(ratings) / len(ratings), 1) if ratings else 0, 'average rating', 'decimal'),
                _metric(len(ratings), 'ratings submitted'),
                _metric(len(completed_today), 'rides completed today')
            ]
        }
    })

    systems = [
        {
            'title': 'OpenAI assistant',
            'status': chatbot_status['status_label'],
            'detail': chatbot_status['detail'],
            'tone': 'good' if chatbot_status['ready'] else 'warning'
        },
        {
            'title': 'Payments and wallet',
            'status': 'Live' if topups_today or successful_payments_today else 'Ready',
            'detail': (
                f'{len(topups_today)} top-ups and {len(successful_payments_today)} '
                f'successful ride payments today.'
            ),
            'tone': 'good'
        },
        {
            'title': 'Driver network',
            'status': 'Active' if active_vehicles else 'Standby',
            'detail': (
                f'{len(approved_drivers)} approved drivers and '
                f'{len(active_vehicles)} active vehicles are available.'
            ),
            'tone': 'good' if active_vehicles else 'neutral'
        },
        {
            'title': 'Safety monitoring',
            'status': 'Armed' if open_sos_alerts else 'Ready',
            'detail': (
                f'{len(open_sos_alerts)} open SOS alerts across '
                f'{len(active_trips)} active trips.'
            ),
            'tone': 'critical' if open_sos_alerts else 'neutral'
        }
    ]

    feed = _build_activity_feed(trips, topups_today)

    return {
        'generated_at': now.isoformat(),
        'stats': {
            'pending_requests': len(pending_requests),
            'scheduled_trips': len(scheduled_trips),
            'active_vehicles': len(active_vehicles),
            'active_trips': len(active_trips),
            'completed_trips_today': len(completed_today),
            'today_revenue': today_revenue,
            'wallet_topups_today': today_topup_total,
            'verified_drivers': len(approved_drivers),
            'pending_driver_applications': len(pending_driver_applications),
            'average_rating': round(sum(ratings) / len(ratings), 1) if ratings else 0,
            'rated_trip_count': len(ratings),
            'sos_alerts': len(sos_alerts),
            'open_sos_alerts': len(open_sos_alerts),
            'coverage_points': len(map_points),
            'live_record_count': len(feed),
            'successful_payments_today': len(successful_payments_today)
        },
        'map_points': map_points,
        'services': services,
        'systems': systems,
        'feed': feed,
        'chatbot': chatbot_status
    }


@services_bp.route('/dashboard', methods=['GET'])
def services_dashboard():
    return jsonify(_build_services_dashboard_payload()), 200


@services_bp.route('/dashboard/stream', methods=['GET'])
def services_dashboard_stream():
    def event_stream():
        last_payload = None
        last_heartbeat_at = time.monotonic()

        try:
            while True:
                payload = _build_services_dashboard_payload()
                serialized = json.dumps(payload, sort_keys=True)

                if serialized != last_payload:
                    last_payload = serialized
                    yield f'event: dashboard\ndata: {serialized}\n\n'
                    last_heartbeat_at = time.monotonic()
                elif time.monotonic() - last_heartbeat_at >= 15:
                    heartbeat = json.dumps({
                        'generated_at': datetime.now(timezone.utc).isoformat()
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
