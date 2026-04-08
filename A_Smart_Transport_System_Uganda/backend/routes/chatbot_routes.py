from flask import Blueprint, jsonify, request

try:
    from ..utils.openai_service import (
        ChatbotUnavailableError,
        generate_chatbot_reply,
        get_chatbot_runtime_status
    )
except ImportError:
    from utils.openai_service import (
        ChatbotUnavailableError,
        generate_chatbot_reply,
        get_chatbot_runtime_status
    )


chatbot_bp = Blueprint('chatbot_routes', __name__)


def _build_fallback_reply(message):
    lowered = str(message or '').lower().strip()

    if any(greet in lowered for greet in ['hi', 'hello', 'hey']):
        return (
            'Hello. The OpenAI assistant is temporarily limited right now, '
            'but I can still help with ASTS booking, payments, safety, and driver support.'
        )
    if any(word in lowered for word in ['book', 'ride', 'taxi', 'boda', 'trip']):
        return (
            'To book a ride, open the Book a Ride page, choose your service, set pickup and destination, '
            'then confirm the request. The driver dashboard receives pending trips in real time.'
        )
    if any(word in lowered for word in ['wallet', 'top up', 'topup', 'pay', 'payment', 'fare', 'price', 'cost']):
        return (
            'Payments are handled from the wallet and trip flow. You can top up your balance, '
            'pay for completed trips, and review payment history from the Payments page.'
        )
    if any(word in lowered for word in ['safe', 'safety', 'sos', 'emergency']):
        return (
            'ASTS safety tools include verified drivers, live vehicle tracking, and an SOS flow '
            'for urgent incidents. The Safety page is the best place to manage those features.'
        )
    if any(word in lowered for word in ['driver', 'license', 'vehicle', 'dashboard']):
        return (
            'Drivers can register with their licence and vehicle details, then manage live ride requests '
            'from the driver dashboard once approved.'
        )
    if any(word in lowered for word in ['ussd', 'offline', 'feature phone']):
        return (
            'Passengers can use the USSD flow by dialing *123# to book and check transport options '
            'without internet access.'
        )
    if any(word in lowered for word in ['contact', 'support', 'help']):
        return (
            'You can reach support at +256800123456 or use the Contact page for more help.'
        )
    return (
        'The OpenAI assistant is temporarily unavailable, so I can only give limited ASTS guidance right now. '
        'Ask about booking, payments, safety, driver onboarding, services, or support.'
    )


@chatbot_bp.route('/', methods=['POST'])
def chat():
    data = request.get_json() or {}
    message = str(data.get('message') or '').strip()
    history = data.get('history') or []

    if not message:
        return jsonify({'error': 'Message format invalid'}), 400
    if not isinstance(history, list):
        history = []

    try:
        result = generate_chatbot_reply(message, history=history)
        return jsonify({
            **result,
            'fallback': False,
            'status': get_chatbot_runtime_status()
        }), 200
    except ChatbotUnavailableError as error:
        status = get_chatbot_runtime_status()
        return jsonify({
            'reply': _build_fallback_reply(message),
            'sources': [],
            'provider': 'Fallback Assistant',
            'fallback': True,
            'notice': str(error),
            'status': status
        }), 200


@chatbot_bp.route('/status', methods=['GET'])
def chatbot_status():
    return jsonify(get_chatbot_runtime_status()), 200
