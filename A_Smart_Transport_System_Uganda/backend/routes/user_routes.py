import os
import json
import random
import re
import string
import time
import uuid
from datetime import datetime, timedelta, timezone
from flask import (
    Blueprint, request, jsonify, current_app, Response, stream_with_context
)
from werkzeug.utils import secure_filename

try:
    from ..models.user_model import User
    from ..models.driver_model import Driver
    from ..models.vehicle_model import Vehicle
    from ..models.wallet_model import Wallet
    from ..models.wallet_transaction_model import WalletTransaction
    from ..models.trip_model import Trip
    from ..models.two_factor_setting_model import TwoFactorSetting
    from ..models.two_factor_challenge_model import TwoFactorChallenge
    from ..models.profile_image_model import ProfileImage
    from ..database import db
    from ..utils.sms_service import deliver_two_factor_code
except ImportError:
    from models.user_model import User
    from models.driver_model import Driver
    from models.vehicle_model import Vehicle
    from models.wallet_model import Wallet
    from models.wallet_transaction_model import WalletTransaction
    from models.trip_model import Trip
    from models.two_factor_setting_model import TwoFactorSetting
    from models.two_factor_challenge_model import TwoFactorChallenge
    from models.profile_image_model import ProfileImage
    from database import db
    from utils.sms_service import deliver_two_factor_code

user_bp = Blueprint('user_bp', __name__)


DRIVER_VEHICLE_TYPES = {
    'Taxi': 4,
    'Boda Boda': 1,
    'Special Hire': 4,
    'Mini Bus': 14,
    'Bus': 60,
    'Marine': 100
}

DRIVER_VEHICLE_ALIASES = {
    'taxi': 'Taxi',
    'standard taxi': 'Taxi',
    'boda': 'Boda Boda',
    'boda boda': 'Boda Boda',
    'special hire': 'Special Hire',
    'mini bus': 'Mini Bus',
    'minibus': 'Mini Bus',
    'smart bus': 'Bus',
    'bus': 'Bus',
    'marine transport': 'Marine',
    'marine': 'Marine'
}

PASSWORD_SPECIAL_CHAR_RE = re.compile(r'[^A-Za-z0-9]')
PASSWORD_REQUIREMENTS = (
    'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.'
)
ALLOWED_PROFILE_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def generate_nol_card_number():
    return ''.join(random.choices(string.digits, k=10))


def normalize_vehicle_type(value):
    normalized = str(value or '').strip().lower()
    return DRIVER_VEHICLE_ALIASES.get(normalized)


def normalize_number_plate(value):
    return ' '.join(str(value or '').upper().split())


def normalize_two_factor_method(value):
    normalized = str(value or 'sms').strip().lower()
    if normalized not in {'sms', 'email'}:
        return None
    return normalized


def evaluate_password_strength(password):
    value = str(password or '')
    checks = {
        'length': len(value) >= 8,
        'lower': any(char.islower() for char in value),
        'upper': any(char.isupper() for char in value),
        'digit': any(char.isdigit() for char in value),
        'symbol': bool(PASSWORD_SPECIAL_CHAR_RE.search(value))
    }
    score = sum(checks.values())

    if len(value) < 6 or score <= 2:
        return 'very_weak', checks
    if score == 3:
        return 'weak', checks
    if score == 4:
        return 'medium', checks
    return 'strong', checks


def ensure_strong_password(password):
    strength, _ = evaluate_password_strength(password)
    if strength != 'strong':
        return jsonify({
            'error': f'Password is too weak. {PASSWORD_REQUIREMENTS}'
        }), 400
    return None


def get_profile_image_upload_dir():
    return current_app.config['PROFILE_PHOTO_UPLOAD_DIR']


def remove_profile_image_file(profile_image):
    if not profile_image or not profile_image.storage_path:
        return

    file_path = os.path.join(
        current_app.static_folder, profile_image.storage_path
    )
    if not os.path.exists(file_path):
        return

    try:
        os.remove(file_path)
    except PermissionError:
        # Windows may keep a short-lived lock after a recent read; the
        # database record is still removed so the profile stops using it.
        return


def save_profile_image(uploaded_file):
    original_name = secure_filename(uploaded_file.filename or '')
    _, extension = os.path.splitext(original_name.lower())

    if extension not in ALLOWED_PROFILE_IMAGE_EXTENSIONS:
        return None, jsonify({
            'error': 'Use a JPG, PNG, or WEBP image for your profile photo.'
        }), 400

    generated_name = f'{uuid.uuid4().hex}{extension}'
    upload_dir = get_profile_image_upload_dir()
    file_path = os.path.join(upload_dir, generated_name)

    uploaded_file.save(file_path)

    return {
        'storage_path': os.path.join('uploads', 'profile-photos', generated_name),
        'original_name': original_name,
        'content_type': uploaded_file.mimetype
    }, None, None


def create_two_factor_challenge(user, method):
    TwoFactorChallenge.query.filter_by(
        user_id=user.id, is_used=False
    ).delete(synchronize_session=False)

    challenge = TwoFactorChallenge(
        user_id=user.id,
        method=method,
        code=''.join(random.choices(string.digits, k=6)),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    db.session.add(challenge)
    db.session.commit()
    return challenge


@user_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}

    if not all(k in data for k in ('name', 'email', 'phone', 'password')):
        return jsonify({'error': 'Missing required fields'}), 400

    password_error = ensure_strong_password(data.get('password'))
    if password_error:
        return password_error

    role = data.get('role', 'passenger')
    two_factor_enabled = bool(data.get('two_factor_enabled'))
    two_factor_method = None
    license_number = None
    vehicle_type = None
    number_plate = None
    vehicle_capacity = None

    if two_factor_enabled:
        two_factor_method = normalize_two_factor_method(
            data.get('two_factor_method')
        )
        if not two_factor_method:
            return jsonify({
                'error': 'Two-factor authentication requires a valid method'
            }), 400

    if role == 'driver':
        if not all(data.get(field) for field in (
            'license_number', 'vehicle_type', 'number_plate'
        )):
            return jsonify({
                'error': (
                    'Driver registration requires a license number, '
                    'vehicle type, and plate or registration number'
                )
            }), 400

        license_number = str(data['license_number']).strip().upper()
        vehicle_type = normalize_vehicle_type(data['vehicle_type'])
        number_plate = normalize_number_plate(data['number_plate'])

        if not license_number or not number_plate:
            return jsonify({
                'error': (
                    'Driver registration requires a valid license number '
                    'and plate or registration number'
                )
            }), 400

        if not vehicle_type:
            return jsonify({'error': 'Unsupported vehicle type selected'}), 400

        if Driver.query.filter_by(license_number=license_number).first():
            return jsonify({
                'error': 'A driver with this license number already exists'
            }), 409

        if Vehicle.query.filter_by(number_plate=number_plate).first():
            return jsonify({
                'error': 'A vehicle with this plate or registration already exists'
            }), 409

        try:
            vehicle_capacity = int(
                data.get('vehicle_capacity') or
                DRIVER_VEHICLE_TYPES[vehicle_type]
            )
        except (TypeError, ValueError):
            return jsonify({'error': 'Vehicle capacity must be a number'}), 400

        if vehicle_capacity < 1:
            return jsonify({
                'error': 'Vehicle capacity must be at least 1'
            }), 400

    if (User.query.filter_by(email=data['email']).first() or
            User.query.filter_by(phone=data['phone']).first()):
        return jsonify({
            'error': 'User with this email or phone already exists'
        }), 409

    new_user = User(
        name=data['name'],
        email=data['email'],
        phone=data['phone'],
        password=data['password'],
        role=role
    )

    db.session.add(new_user)
    db.session.flush()

    if two_factor_enabled:
        db.session.add(TwoFactorSetting(
            user_id=new_user.id,
            method=two_factor_method,
            is_enabled=True
        ))

    if role == 'driver':
        new_driver = Driver(user_id=new_user.id, license_number=license_number)
        db.session.add(new_driver)
        db.session.flush()

        db.session.add(Vehicle(
            driver_id=new_driver.id,
            number_plate=number_plate,
            capacity=vehicle_capacity,
            current_passengers=0,
            vehicle_type=vehicle_type,
            is_active=False
        ))
    elif role == 'passenger':
        db.session.add(Wallet(
            user_id=new_user.id,
            balance=0.0,
            card_number=generate_nol_card_number()
        ))

    db.session.commit()

    return jsonify({
        'message': 'User registered successfully',
        'user': new_user.to_dict()
    }), 201


@user_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}

    if not all(k in data for k in ('email', 'password')):
        return jsonify({'error': 'Missing email or password'}), 400

    user = User.query.filter_by(email=data['email']).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    two_factor_setting = getattr(user, 'two_factor_setting', None)
    if two_factor_setting and two_factor_setting.is_enabled:
        challenge = create_two_factor_challenge(user, two_factor_setting.method)
        delivery = deliver_two_factor_code(
            user, two_factor_setting.method, challenge.code
        )

        return jsonify({
            'message': (
                f'Verification code sent via {delivery["channel"]}. '
                'Enter the code to finish signing in.'
            ),
            'requires_two_factor': True,
            'challenge_id': challenge.id,
            'two_factor': {
                'channel': delivery['channel'],
                'destination': delivery['masked_destination'],
                'method': two_factor_setting.method
            },
            'demo_code': delivery['demo_code']
        }), 200

    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict()
    }), 200


@user_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # In a real system, we'd send an email. Here we just mock the success.
    return jsonify({
        'message': 'If an account exists with this email, a reset link has been sent.'
    }), 200


@user_bp.route('/google-login', methods=['POST'])
def google_login():
    # Mocking Google Auth functionality for demonstration.
    email = 'google.user@example.com'
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(
            name='Google User',
            email=email,
            phone='0700000000',
            password='google_mock_auth',
            role='passenger'
        )
        db.session.add(user)
        db.session.flush()
        db.session.add(Wallet(user_id=user.id, balance=25000, card_number=generate_nol_card_number()))
        db.session.commit()

    return jsonify({
        'message': 'Google Sign-In successful',
        'user': user.to_dict()
    }), 200


@user_bp.route('/verify-2fa', methods=['POST'])
def verify_two_factor():
    data = request.get_json() or {}
    challenge_id = data.get('challenge_id')
    code = str(data.get('code') or '').strip()

    if not challenge_id or not code:
        return jsonify({'error': 'Missing challenge_id or verification code'}), 400

    try:
        challenge_id = int(challenge_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid challenge_id'}), 400

    challenge = db.session.get(TwoFactorChallenge, challenge_id)
    if not challenge or challenge.is_used:
        return jsonify({'error': 'Two-factor challenge is invalid'}), 400

    if challenge.is_expired():
        return jsonify({
            'error': 'Two-factor code has expired. Please sign in again.'
        }), 400

    if challenge.code != code:
        return jsonify({'error': 'Incorrect verification code'}), 401

    challenge.is_used = True
    db.session.commit()

    return jsonify({
        'message': 'Login successful',
        'user': challenge.user.to_dict()
    }), 200


@user_bp.route('/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    user = db.get_or_404(User, user_id)
    return jsonify({
        'user': user.to_dict()
    }), 200


@user_bp.route('/<int:user_id>/profile-photo', methods=['POST'])
def upload_profile_photo(user_id):
    user = db.get_or_404(User, user_id)
    uploaded_file = request.files.get('photo')

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({'error': 'Choose an image before uploading.'}), 400

    image_payload, error_response, status_code = save_profile_image(
        uploaded_file
    )
    if error_response:
        return error_response, status_code

    profile_image = user.profile_image
    if profile_image:
        remove_profile_image_file(profile_image)
        profile_image.storage_path = image_payload['storage_path']
        profile_image.original_name = image_payload['original_name']
        profile_image.content_type = image_payload['content_type']
    else:
        db.session.add(ProfileImage(
            user_id=user.id,
            storage_path=image_payload['storage_path'],
            original_name=image_payload['original_name'],
            content_type=image_payload['content_type']
        ))

    db.session.commit()

    return jsonify({
        'message': 'Profile photo updated successfully',
        'user': user.to_dict()
    }), 200


@user_bp.route('/<int:user_id>/profile-photo', methods=['DELETE'])
def delete_profile_photo(user_id):
    user = db.get_or_404(User, user_id)
    profile_image = user.profile_image

    if not profile_image:
        return jsonify({'error': 'No profile photo was found for this account.'}), 404

    remove_profile_image_file(profile_image)
    db.session.delete(profile_image)
    db.session.commit()
    db.session.expire(user, ['profile_image'])

    return jsonify({
        'message': 'Profile photo removed successfully',
        'user': user.to_dict()
    }), 200


def _as_utc(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _get_driver_dashboard_payload(user_id):
    user = db.session.get(User, user_id)
    driver_profile = user.driver_profile if user else None

    if not user or user.role != 'driver' or not driver_profile:
        return None

    vehicles = list(driver_profile.vehicles)
    vehicle_ids = [vehicle.id for vehicle in vehicles]

    trips = []
    if vehicle_ids:
        trips = (
            Trip.query
            .filter(Trip.vehicle_id.in_(vehicle_ids))
            .order_by(Trip.created_at.desc())
            .all()
        )

    today = datetime.now(timezone.utc).date()
    paid_completed_trips = [
        trip for trip in trips
        if trip.status == 'completed' and trip.payment and
        trip.payment.status == 'success'
    ]
    pending_trips = [trip for trip in trips if trip.status == 'pending']
    active_trips = [trip for trip in trips if trip.status == 'active']
    rated_trips = [trip.rating for trip in paid_completed_trips if trip.rating]
    withdrawal_transactions = (
        WalletTransaction.query
        .filter_by(user_id=user.id, transaction_type='driver_withdrawal')
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )

    earnings_total = round(sum(trip.fare for trip in paid_completed_trips), 2)
    withdrawn_total = round(
        sum(txn.amount for txn in withdrawal_transactions), 2
    )
    available_earnings = round(
        max(earnings_total - withdrawn_total, 0), 2
    )

    return {
        'driver': user.to_dict(),
        'pending_trips': [trip.to_dict() for trip in pending_trips],
        'active_trips': [trip.to_dict() for trip in active_trips],
        'recent_trips': [trip.to_dict() for trip in paid_completed_trips[:5]],
        'stats': {
            'rides_today': sum(
                1 for trip in paid_completed_trips
                if _as_utc(trip.created_at).date() == today
            ),
            'completed_rides': len(paid_completed_trips),
            'earnings_total': earnings_total,
            'available_earnings': available_earnings,
            'withdrawn_total': withdrawn_total,
            'avg_rating': (
                round(sum(rated_trips) / len(rated_trips), 1)
                if rated_trips else 0
            ),
            'online': any(v.is_active for v in vehicles),
            'active_vehicle_count': sum(1 for v in vehicles if v.is_active),
            'pending_trip_count': len(pending_trips),
            'active_trip_count': len(active_trips),
            'live_record_count': (
                len(pending_trips) + len(active_trips) +
                min(len(paid_completed_trips), 5)
            ),
            'streamed_at': datetime.now(timezone.utc).isoformat()
        },
        'vehicles': [v.to_dict() for v in vehicles],
        'withdrawals': [
            {
                'id': txn.id,
                'amount': txn.amount,
                'payment_method': txn.payment_method,
                'reference': txn.reference,
                'created_at': txn.created_at.isoformat()
            }
            for txn in withdrawal_transactions[:5]
        ]
    }


@user_bp.route('/<int:user_id>/driver-dashboard', methods=['GET'])
def driver_dashboard(user_id):
    user = db.get_or_404(User, user_id)
    driver_profile = user.driver_profile

    if user.role != 'driver' or not driver_profile:
        return jsonify({'error': 'Driver profile not found'}), 404

    payload = _get_driver_dashboard_payload(user.id)
    return jsonify(payload), 200


@user_bp.route('/<int:user_id>/driver-dashboard/stream', methods=['GET'])
def driver_dashboard_stream(user_id):
    user = db.get_or_404(User, user_id)
    driver_profile = user.driver_profile

    if user.role != 'driver' or not driver_profile:
        return jsonify({'error': 'Driver profile not found'}), 404

    def event_stream():
        last_payload = None
        last_heartbeat_at = time.monotonic()

        try:
            while True:
                payload = _get_driver_dashboard_payload(user_id)
                serialized = json.dumps(payload, sort_keys=True)

                if serialized != last_payload:
                    last_payload = serialized
                    yield f'event: dashboard\ndata: {serialized}\n\n'
                    last_heartbeat_at = time.monotonic()
                elif time.monotonic() - last_heartbeat_at >= 15:
                    heartbeat = json.dumps({
                        'streamed_at': datetime.now(timezone.utc).isoformat()
                    })
                    yield f'event: heartbeat\ndata: {heartbeat}\n\n'
                    last_heartbeat_at = time.monotonic()

                time.sleep(2)
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


@user_bp.route('/<int:user_id>/driver-status', methods=['POST'])
def update_driver_status(user_id):
    user = db.get_or_404(User, user_id)
    driver_profile = user.driver_profile

    if user.role != 'driver' or not driver_profile:
        return jsonify({'error': 'Driver profile not found'}), 404

    data = request.get_json() or {}
    if 'active' not in data:
        return jsonify({'error': 'Missing active status'}), 400

    active = bool(data['active'])
    for vehicle in driver_profile.vehicles:
        vehicle.is_active = active

    db.session.commit()

    return jsonify({
        'message': 'Driver availability updated',
        'online': active,
        'vehicles': [vehicle.to_dict() for vehicle in driver_profile.vehicles]
    }), 200


@user_bp.route('/<int:user_id>/driver-withdrawals', methods=['POST'])
def create_driver_withdrawal(user_id):
    user = db.get_or_404(User, user_id)
    driver_profile = user.driver_profile

    if user.role != 'driver' or not driver_profile:
        return jsonify({'error': 'Driver profile not found'}), 404

    data = request.get_json() or {}
    method = str(data.get('method') or '').strip()
    account_reference = str(data.get('account_reference') or '').strip()
    payout_note = str(data.get('note') or '').strip()

    try:
        amount = round(float(data.get('amount') or 0), 2)
    except (TypeError, ValueError):
        return jsonify({'error': 'Withdrawal amount must be a valid number'}), 400

    if amount <= 0:
        return jsonify({'error': 'Withdrawal amount must be greater than zero'}), 400

    if method not in {'MTN Mobile Money', 'Airtel Money', 'Bank Transfer'}:
        return jsonify({'error': 'Choose a valid withdrawal method'}), 400

    if not account_reference:
        return jsonify({
            'error': 'Enter the mobile money number or bank account reference'
        }), 400

    dashboard = _get_driver_dashboard_payload(user.id) or {}
    available_earnings = dashboard.get('stats', {}).get(
        'available_earnings', 0
    )

    if amount > available_earnings:
        return jsonify({
            'error': 'Withdrawal amount exceeds available earnings',
            'available_earnings': available_earnings
        }), 400

    stored_method = f'{method} ({account_reference})'[:50]
    withdrawal = WalletTransaction(
        user_id=user.id,
        amount=amount,
        transaction_type='driver_withdrawal',
        payment_method=stored_method,
        reference=f'PAYOUT_{uuid.uuid4().hex[:10].upper()}'
    )
    db.session.add(withdrawal)
    db.session.commit()

    updated_dashboard = _get_driver_dashboard_payload(user.id)

    return jsonify({
        'message': (
            f'{amount:,.0f} UGX payout requested via {method}. '
            'The finance queue has been updated.'
        ),
        'withdrawal': {
            'id': withdrawal.id,
            'amount': withdrawal.amount,
            'payment_method': withdrawal.payment_method,
            'reference': withdrawal.reference,
            'created_at': withdrawal.created_at.isoformat(),
            'account_reference': account_reference,
            'note': payout_note
        },
        'dashboard': updated_dashboard
    }), 201
