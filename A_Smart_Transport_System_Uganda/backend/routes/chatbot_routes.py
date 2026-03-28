from flask import Blueprint, request, jsonify

chatbot_bp = Blueprint('chatbot_routes', __name__)

@chatbot_bp.route('/', methods=['POST'])
def chat():
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'Message format invalid'}), 400

    message = str(data['message']).lower().strip()

    # Base NLP Logic translated from frontend
    if any(greet in message for greet in ['hi', 'hello', 'hey']):
        reply = "Hello! How can I assist you with your transport today?"
    elif any(word in message for word in ['book', 'ride', 'taxi']):
        reply = "To book a ride, go to the 'Book a Ride' page, enter your pickup/dropoff locations, select the vehicle type, and confirm. It's fast and easy!"
    elif any(word in message for word in ['pay', 'cost', 'price', 'fare', 'wallet']):
        reply = "We calculate fares transparently using GPS distance. You can pay seamlessly using Mobile Money, Card, or from your topped-up Wallet via the 'SmartCard'."
    elif any(word in message for word in ['safe', 'security', 'sos']):
        reply = "Safety is our priority. All drivers are verified, vehicles are GPS tracked in real-time, and you can share your trip with contacts. We also have an SOS emergency button!"
    elif any(word in message for word in ['contact', 'support', 'help']):
        reply = "You can reach our 24/7 support line at +256800123456 or email support@sts.ug."
    elif 'driver' in message:
        reply = "Are you a driver? You can register directly on our platform. Once approved, you can start accepting rides through the Driver Dashboard live."
    elif any(word in message for word in ['ussd', 'offline']):
        reply = "No smartphone? No problem! Dial *123# to access our USSD booking system and request a ride completely offline."
    else:
        # Fallback for unknown messages
        reply = "I'm still learning! If you have a specific issue, please contact our human support team or visit the 'About Us' and 'Services' pages for more info."

    return jsonify({'reply': reply}), 200
