from flask import Blueprint, request, jsonify
from datetime import datetime

try:
    from ..models.user_model import User
    from ..models.wallet_model import Wallet
    from ..models.trip_model import Trip
    from ..models.vehicle_model import Vehicle
    from ..models.trip_log_model import TripLog
    from ..ai.fare_prediction import predict_fare
    from ..database import db
    from ..utils.sunbird_service import translate_text
except ImportError:
    from models.user_model import User
    from models.wallet_model import Wallet
    from models.trip_model import Trip
    from models.vehicle_model import Vehicle
    from models.trip_log_model import TripLog
    from ai.fare_prediction import predict_fare
    from database import db
    from utils.sunbird_service import translate_text

ussd_bp = Blueprint('ussd_bp', __name__)

# In-memory session store (use Redis in production)
sessions = {}


def localize(text, lang='en'):
    if not lang or lang == 'en':
        return text
    return translate_text(text, source_lang='en', target_lang=lang)


def get_session(session_id, user_name):
    if session_id not in sessions:
        sessions[session_id] = {'state': 'IDLE', 'name': user_name, 'data': {}}
    return sessions[session_id]


def clear_session(session_id):
    if session_id in sessions:
        del sessions[session_id]


def make_main_menu(name):
    return (
        f"CON STS Uganda *250# — Hello, {name}!\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "1. Book a Ride\n"
        "2. Check Wallet Balance\n"
        "3. My Active Trip\n"
        "4. SOS Emergency\n"
        "5. Contact Support\n"
        "0. Exit"
    )

BOOK_MENU = (
    "CON Book a Ride\n"
    "Select vehicle type:\n"
    "1. Standard Taxi\n"
    "2. Boda Boda\n"
    "3. Smart Bus\n"
    "4. Special Hire\n"
    "0. Back to Main Menu"
)

SUPPORT_MENU = (
    "CON STS Support\n"
    "1. Contact STS Helpline\n"
    "2. Report a Problem\n"
    "3. Lost & Found\n"
    "0. Back to Main Menu"
)


@ussd_bp.route('/simulate', methods=['POST'])
def simulate_ussd():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    input_text = data.get('text', '').strip()
    session_id = data.get('session_id', phone)

    user = User.query.filter_by(phone=phone).first()
    lang = user.preferred_language if user else 'en'

    if not user:
        msg = (
            "CON Welcome to STS Uganda *250#\n"
            "Your phone number is not registered.\n"
            "Please visit our website to create\n"
            "an account and get started.\n"
            "0. Exit"
        )
        return jsonify({'message': localize(msg, lang)}), 200

    sess = get_session(session_id, user.name.split()[0])
    state = sess['state']

    # ─── IDLE → Start main menu ───────────────────────────────
    if state == 'IDLE' or input_text == '':
        sess['state'] = 'MAIN_MENU'
        return jsonify({'message': localize(make_main_menu(sess['name']), lang)}), 200

    # ─── MAIN MENU selections ─────────────────────────────────
    if state == 'MAIN_MENU':
        if input_text == '1':
            sess['state'] = 'BOOK_MENU'
            return jsonify({'message': localize(BOOK_MENU, lang)}), 200

        elif input_text == '2':
            try:
                wallet = Wallet.query.filter_by(user_id=user.id).first()
                balance = wallet.balance if wallet else 0
            except Exception:
                balance = 0
            try:
                trips_done = db.session.execute(
                    db.text("SELECT COUNT(*) FROM trips WHERE passenger_id=:uid AND status='completed'"),
                    {'uid': user.id}
                ).scalar() or 0
            except Exception:
                trips_done = 0
            clear_session(session_id)
            return jsonify({'message': localize((
                f"END STS SmartCard Balance\n"
                f"------------------------\n"
                f"Balance: UGX {balance:,.0f}\n"
                f"Total Trips: {trips_done}\n"
                f"Phone: {phone}\n"
                f"------------------------\n"
                f"Top up at STS Uganda App.\n"
                f"Thank you!"
            ), lang)}), 200

        elif input_text == '3':
            active = Trip.query.filter_by(passenger_id=user.id, status='active').first()
            clear_session(session_id)
            if active:
                v = active.vehicle
                driver = v.driver.user.name if v and v.driver and v.driver.user else 'Unassigned'
                plate = v.number_plate if v else 'N/A'
                return jsonify({'message': localize((
                    f"END Active Trip #{active.id}\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"From: {active.start_location}\n"
                    f"To:   {active.end_location}\n"
                    f"Driver: {driver}\n"
                    f"Plate:  {plate}\n"
                    f"Fare: UGX {active.fare:,.0f}\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"Safe travels!"
                ), lang)}), 200
            else:
                return jsonify({'message': localize((
                    "END No active trip found.\n"
                    "Book a ride via the STS app\n"
                    "or dial *250# again."
                ), lang)}), 200

        elif input_text == '4':
            # SOS
            active = Trip.query.filter_by(passenger_id=user.id, status='active').first()
            if active:
                active.is_sos = True
                active.sos_description = f"USSD SOS triggered by {user.name} at {datetime.now().strftime('%H:%M on %d %b %Y')}"
                db.session.commit()
            clear_session(session_id)
            return jsonify({'message': localize((
                "END 🚨 SOS ALERT SENT!\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                "Your location has been shared\n"
                "with STS Operations & Police.\n"
                "Stay calm. Help is coming.\n"
                "Emergency: 999 / 0800 999 111\n"
                "━━━━━━━━━━━━━━━━━━━━━━"
            ), lang)}), 200

        elif input_text == '5':
            sess['state'] = 'SUPPORT_MENU'
            return jsonify({'message': localize(SUPPORT_MENU, lang)}), 200

        elif input_text == '0':
            clear_session(session_id)
            return jsonify({'message': localize((
                "END Thank you for using\n"
                "STS Uganda *250#\n"
                "Safe travels!"
            ), lang)}), 200

        else:
            return jsonify({'message': 'CON Invalid option.\n' + make_main_menu(sess['name'])[4:]}), 200

    # ─── BOOKING SUBMENU (Step 1: Vehicle Type) ─────────────────────────
    if state == 'BOOK_MENU':
        vehicle_map = {'1': 'Taxi', '2': 'Boda Boda', '3': 'Bus', '4': 'Special Hire'}
        if input_text == '0':
            sess['state'] = 'MAIN_MENU'
            return jsonify({'message': localize(make_main_menu(sess['name']), lang)}), 200
        elif input_text in vehicle_map:
            sess['data']['vtype'] = vehicle_map[input_text]
            sess['state'] = 'BOOK_PICKUP'
            return jsonify({'message': localize("CON Where are you? (Pickup Location)\ne.g. Entebbe Road, Old Taxi Park", lang)}), 200
        else:
            return jsonify({'message': localize(BOOK_MENU.replace("CON", "CON Invalid option.\n"), lang)}), 200

    # ─── BOOKING SUBMENU (Step 2: Pickup) ──────────────────────────────
    if state == 'BOOK_PICKUP':
        if input_text == '0':
            sess['state'] = 'BOOK_MENU'
            return jsonify({'message': localize(BOOK_MENU, lang)}), 200
        sess['data']['pickup'] = input_text
        sess['state'] = 'BOOK_DESTINATION'
        return jsonify({'message': localize(f"CON Going where from {input_text}?\n(Destination Location)", lang)}), 200

    # ─── BOOKING SUBMENU (Step 3: Destination & Confirm) ────────────────
    if state == 'BOOK_DESTINATION':
        if input_text == '0':
            sess['state'] = 'BOOK_PICKUP'
            return jsonify({'message': localize("CON Where are you? (Pickup Location)", lang)}), 200
        
        pickup = sess['data'].get('pickup', 'Unknown')
        destination = input_text
        vtype = sess['data'].get('vtype', 'Taxi')
        
        # 1. Calculate fare using ASTS AI Engine
        # For USSD we assume a standard 5km city hop for the estimate
        fare = predict_fare(distance_km=5.0, vehicle_type=vtype)
        
        # 2. Assign any active vehicle of that type (Marketplace logic)
        vehicle = Vehicle.query.filter_by(vehicle_type=vtype, is_active=True).first()
        
        if not vehicle:
             clear_session(session_id)
             return jsonify({'message': localize((
                f"END No {vtype} available\n"
                f"at the moment near {pickup}.\n"
                f"Please try again shortly."
            ), lang)}), 200

        new_trip = Trip(
            passenger_id=user.id,
            vehicle_id=vehicle.id,
            start_location=pickup,
            end_location=destination,
            fare=fare,
            status='pending'
        )
        db.session.add(new_trip)
        db.session.flush()

        # Audit Log: Record the USSD booking interaction
        log_msg = f"USSD Booking: {user.name} requested {vtype} from {pickup} to {destination}. AI Predicted Fare: UGX {fare:,.0f}."
        db.session.add(TripLog(trip_id=new_trip.id, event_type='REQUEST', message=log_msg))
        
        db.session.commit()
        
        driver_name = vehicle.driver.user.name if vehicle.driver and vehicle.driver.user else 'STS Driver'
        clear_session(session_id)
        
        return jsonify({'message': localize((
            f"END Request Sent Successfully!\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Mode:   {vtype} (AI Guided)\n"
            f"Pickup: {pickup}\n"
            f"Drop:   {destination}\n"
            f"Driver: {driver_name}\n"
            f"Plate:  {vehicle.number_plate}\n"
            f"Fare:   UGX {fare:,.0f}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Safe travels!"
        ), lang)}), 200

    # ─── SUPPORT SUBMENU ──────────────────────────────────────
    if state == 'SUPPORT_MENU':
        if input_text == '1':
            clear_session(session_id)
            return jsonify({'message': localize((
                "END STS Helpline\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                "Call: +256 800 100 250\n"
                "WhatsApp: +256 700 100 250\n"
                "Hours: 6AM - 10PM Daily\n"
                "Email: support@sts.ug\n"
                "━━━━━━━━━━━━━━━━━━━━━━"
            ), lang)}), 200
        elif input_text == '2':
            clear_session(session_id)
            return jsonify({'message': localize((
                "END Problem Report Submitted\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                "STS team will contact you\n"
                "within 24 hours.\n"
                f"Your number: {phone}\n"
                "━━━━━━━━━━━━━━━━━━━━━━"
            ), lang)}), 200
        elif input_text == '3':
            clear_session(session_id)
            return jsonify({'message': localize((
                "END Lost & Found\n"
                "━━━━━━━━━━━━━━━━━━━━━━\n"
                "Call: +256 800 100 250\n"
                "or visit STS App > History\n"
                "and tap 'Report Lost Item'\n"
                "━━━━━━━━━━━━━━━━━━━━━━"
            ), lang)}), 200
        elif input_text == '0':
            sess['state'] = 'MAIN_MENU'
            return jsonify({'message': localize(make_main_menu(sess['name']), lang)}), 200
        else:
            return jsonify({'message': localize(SUPPORT_MENU.replace("CON", "CON Invalid option.\n"), lang)}), 200

    # ─── Fallback / session reset ─────────────────────────────
    clear_session(session_id)
    return jsonify({'message': localize((
        "END Session expired.\n"
        "Dial *250# to start again."
    ), lang)}), 200
