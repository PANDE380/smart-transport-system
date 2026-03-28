from flask import Blueprint, request, jsonify

try:
    from ..models.user_model import User
    from ..models.wallet_model import Wallet
except ImportError:
    from models.user_model import User
    from models.wallet_model import Wallet

ussd_bp = Blueprint('ussd_bp', __name__)

# Mock USSD Session State
# In a real system, this would be in Redis or Memcached
sessions = {}


@ussd_bp.route('/simulate', methods=['POST'])
def simulate_ussd():
    data = request.get_json()
    phone = data.get('phone')
    input_text = data.get('text', '')  # The string sent by user
    session_id = data.get('session_id', phone)

    user = User.query.filter_by(phone=phone).first()

    if not user:
        return jsonify({'message': 'CON Welcome to A Smart Transport System Uganda.\nYour phone is not registered.\nPlease register on the app or website.'}), 200

    # Basic USSD Logic Flow
    if input_text == '':
        sessions[session_id] = 'MAIN_MENU'
        return jsonify({
            'message': f'CON Hello {user.name},\nChoose an option:\n1. Check SmartCard Balance\n2. Request Nearest Taxi\n3. SOS Emergency'
        }), 200

    if input_text == '1':
        wallet = Wallet.query.filter_by(user_id=user.id).first()
        balance = wallet.balance if wallet else 0
        return jsonify({
            'message': f'END Your SmartCard balance is: {balance:,.0f} UGX.\nThank you for using ASTS Uganda.'
        }), 200

    if input_text == '2':
        return jsonify({
            'message': 'END Searching for the nearest taxi...\nYou will receive an SMS with driver details shortly.'
        }), 200

    if input_text == '3':
        return jsonify({
            'message': 'END SOS ALERT SENT!\nSecurity and emergency services have been notified of your location.'
        }), 200

    return jsonify({'message': 'END Invalid option. Please try again.'}), 200
