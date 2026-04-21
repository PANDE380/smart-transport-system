from flask import Blueprint, jsonify, request


chatbot_bp = Blueprint('chatbot_routes', __name__)


def _get_chatbot_service():
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

    return ChatbotUnavailableError, generate_chatbot_reply, get_chatbot_runtime_status


def _build_fallback_reply(message):
    try:
        from ..utils.knowledge_engine import query_knowledge_engine
    except ImportError:
        from utils.knowledge_engine import query_knowledge_engine
        
    return query_knowledge_engine(message)


@chatbot_bp.route('/', methods=['POST'])
def chat():
    data = request.get_json() or {}
    message = str(data.get('message') or '').strip()
    history = data.get('history') or []
    language = str(data.get('language') or 'English').strip()

    if not message:
        return jsonify({'error': 'Message format invalid'}), 400
    if not isinstance(history, list):
        history = []

    ChatbotUnavailableError, generate_chatbot_reply, get_chatbot_runtime_status = _get_chatbot_service()
    try:
        result = generate_chatbot_reply(message, history=history, language=language)
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
            'provider': 'STS Connect AI',
            'fallback': True,
            'notice': None,
            'status': status
        }), 200


@chatbot_bp.route('/status', methods=['GET'])
def chatbot_status():
    _, _, get_chatbot_runtime_status = _get_chatbot_service()
    return jsonify(get_chatbot_runtime_status()), 200
