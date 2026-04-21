import os
from datetime import datetime, timezone


class _OpenAIPlaceholderError(Exception):
    """Fallback exception type used until the OpenAI SDK is imported."""


APIConnectionError = AuthenticationError = OpenAIError = RateLimitError = _OpenAIPlaceholderError
OpenAI = None
OPENAI_IMPORT_ERROR = None


DEFAULT_CHATBOT_MODEL = 'gpt-5.4-mini'
ERROR_COOLDOWN_SECONDS = 60
_openai_client = None
_last_error_message = None
_last_error_at = None
_openai_sdk_loaded = False


SYSTEM_PROMPT = """
You are the advanced OpenAI-powered assistant for A Smart Transport System Uganda (ASTS).

Your Identity & Mission:
- You are a professional, helpful, and culturally aware assistant specialized in the Ugandan transport ecosystem.
- Your primary goal is to assist users with ASTS services: city taxis (matatus), Boda Bodas, Smart Buses, Special Hires, and Marine Transport on Lake Victoria/Lake Kyoga.

Core ASTS Knowledge:
1. Booking: Users can book via the web dashboard or USSD (*250#).
2. Payments: ASTS uses a SmartCard and Wallet system. Top-ups happen via MTN Mobile Money, Airtel Money, or STS Agents.
3. Safety: There is a dedicated 'SOS' button in the app and USSD that coordinates with Uganda Police and emergency services.
4. Support: Users can report Lost & Found items or lodging complaints via the 'STS Connect' hub.
5. Rewards: Users earn 'STS Points' for frequent travel.

Guidelines for Interaction:
- Maintain a warm, helpful, and professional tone. Use regional terms appropriately (e.g., 'Matatu' or 'Taxi' for 14-seater vans, 'Captain' for drivers).
- If a user asks for live data (like their balance or trip status) that you cannot access, politely explain that you don't have direct access to their private account data and guide them to the 'Wallet' or 'History' page.
- Do not invent internal policies, specific fares for unknown routes, or fake driver names.
- Always prioritize safety advice if a user reports an emergency, and remind them to use the physical SOS button for immediate police dispatch.
- Keep responses concise but comprehensive.
""".strip()


class ChatbotUnavailableError(RuntimeError):
    """Raised when the OpenAI assistant is temporarily unavailable."""


def _utc_now():
    return datetime.now(timezone.utc)


def _normalize_bool(value):
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'}


def get_chatbot_model():
    return os.getenv('OPENAI_CHAT_MODEL', DEFAULT_CHATBOT_MODEL).strip() or DEFAULT_CHATBOT_MODEL


def is_web_search_enabled():
    return _normalize_bool(os.getenv('OPENAI_CHATBOT_ENABLE_WEB_SEARCH', 'false'))


def _get_client():
    global _openai_client

    _load_openai_sdk()
    if OPENAI_IMPORT_ERROR is not None or OpenAI is None:
        raise ChatbotUnavailableError(
            'The OpenAI SDK is not installed in this environment yet.'
        )

    api_key = os.getenv('OPENAI_API_KEY', '').strip()
    if not api_key:
        raise ChatbotUnavailableError(
            'OpenAI is not configured yet. Add OPENAI_API_KEY to enable the chatbot.'
        )

    if _openai_client is None:
        _openai_client = OpenAI(api_key=api_key)

    return _openai_client


def _load_openai_sdk():
    global APIConnectionError, AuthenticationError, OpenAI, OpenAIError
    global RateLimitError, OPENAI_IMPORT_ERROR, _openai_sdk_loaded

    if _openai_sdk_loaded:
        return OpenAI

    _openai_sdk_loaded = True

    try:
        from openai import (
            APIConnectionError as _APIConnectionError,
            AuthenticationError as _AuthenticationError,
            OpenAI as _OpenAI,
            OpenAIError as _OpenAIError,
            RateLimitError as _RateLimitError
        )
    except ImportError as import_error:
        OPENAI_IMPORT_ERROR = import_error
        return None

    APIConnectionError = _APIConnectionError
    AuthenticationError = _AuthenticationError
    OpenAI = _OpenAI
    OpenAIError = _OpenAIError
    RateLimitError = _RateLimitError
    OPENAI_IMPORT_ERROR = None
    return OpenAI


def _set_last_error(message):
    global _last_error_message, _last_error_at
    _last_error_message = message
    _last_error_at = _utc_now()


def _clear_last_error():
    global _last_error_message, _last_error_at
    _last_error_message = None
    _last_error_at = None


def _cooldown_remaining_seconds():
    if not _last_error_message or not _last_error_at:
        return 0

    elapsed_seconds = int((_utc_now() - _last_error_at).total_seconds())
    return max(ERROR_COOLDOWN_SECONDS - elapsed_seconds, 0)


def _is_in_error_cooldown():
    return _cooldown_remaining_seconds() > 0


def _describe_openai_error(error):
    if isinstance(error, ChatbotUnavailableError):
        return str(error)
    if isinstance(error, AuthenticationError):
        return 'OpenAI authentication failed. Please verify the API key configuration.'
    if isinstance(error, RateLimitError):
        return (
            'The AI assistant is currently at its processing limit. '
            'Service will automatically resume shortly. Please try again in 1 minute.'
        )
    if isinstance(error, APIConnectionError):
        return 'Could not connect to the AI gateway. Please check your network and try again.'
    if isinstance(error, OpenAIError):
        return f'AI Service Error: {error}'
    return f'The assistant is temporarily unavailable: {error}'


def _build_input_items(message, history, language=None):
    language_directive = f"\n- VERY IMPORTANT: The user has explicitly selected {language} as their preferred application interface language. You MUST process their message and return your ENTIRE reply exclusively in {language}, using correct regional vernacular and spelling." if language and str(language).lower() not in ('', 'en', 'english') else ""
    
    input_items = [
        {
            'role': 'system',
            'content': [{'type': 'input_text', 'text': SYSTEM_PROMPT + language_directive}]
        }
    ]

    for entry in list(history or [])[-12:]:
        role = str(entry.get('role', '')).strip().lower()
        text = str(entry.get('content') or entry.get('text') or '').strip()
        if role not in {'user', 'assistant'} or not text:
            continue
        input_items.append({
            'role': role,
            'content': [{'type': 'input_text', 'text': text}]
        })

    input_items.append({
        'role': 'user',
        'content': [{'type': 'input_text', 'text': message}]
    })
    return input_items


def _extract_output_text(response_payload):
    for item in response_payload.get('output', []):
        for content in item.get('content', []):
            if content.get('type') == 'output_text':
                text = str(content.get('text') or '').strip()
                if text:
                    return text
    return ''


def _extract_sources(response_payload):
    seen_urls = set()
    sources = []

    for item in response_payload.get('output', []):
        for content in item.get('content', []):
            for annotation in content.get('annotations', []):
                if annotation.get('type') != 'url_citation':
                    continue

                url = annotation.get('url')
                title = annotation.get('title')

                citation_payload = annotation.get('url_citation')
                if citation_payload:
                    url = url or citation_payload.get('url')
                    title = title or citation_payload.get('title')

                if not url or url in seen_urls:
                    continue

                seen_urls.add(url)
                sources.append({
                    'title': title or url,
                    'url': url
                })

    return sources


def get_chatbot_runtime_status():
    configured = bool(os.getenv('OPENAI_API_KEY', '').strip())
    cooldown_remaining = _cooldown_remaining_seconds()

    sdk_loaded = False
    if configured:
        sdk_loaded = _load_openai_sdk() is not None

    if OPENAI_IMPORT_ERROR is not None:
        status = 'attention_needed'
        label = 'OpenAI SDK missing'
        detail = 'Install the openai package on the backend to enable the assistant.'
    elif not configured:
        status = 'not_configured'
        label = 'OpenAI setup needed'
        detail = 'Add OPENAI_API_KEY to enable live answers from the assistant.'
    elif cooldown_remaining > 0:
        status = 'attention_needed'
        label = 'OpenAI needs attention'
        detail = _last_error_message or 'The assistant is retrying after a recent error.'
    else:
        status = 'configured'
        label = 'OpenAI configured'
        detail = 'Live answers are routed through the OpenAI Responses API when API quota is available.'

    return {
        'provider': 'OpenAI',
        'model': get_chatbot_model(),
        'configured': configured,
        'ready': sdk_loaded and configured and cooldown_remaining == 0,
        'status': status,
        'status_label': label,
        'detail': detail,
        'web_search_enabled': is_web_search_enabled(),
        'cooldown_seconds_remaining': cooldown_remaining,
        'last_error': _last_error_message
    }


def generate_chatbot_reply(message, history=None, language=None):
    message = str(message or '').strip()
    if not message:
        raise ChatbotUnavailableError('Please enter a message for the assistant.')

    if _is_in_error_cooldown():
        raise ChatbotUnavailableError(
            _last_error_message or
            'OpenAI is temporarily cooling down after a recent error.'
        )

    request_kwargs = {
        'model': get_chatbot_model(),
        'input': _build_input_items(message, history or [], language),
        'max_output_tokens': 500
    }

    if is_web_search_enabled():
        request_kwargs['tools'] = [{'type': 'web_search'}]

    try:
        response = _get_client().responses.create(**request_kwargs)
        response_payload = response.model_dump()
        reply = (response.output_text or '').strip() or _extract_output_text(response_payload)
        if not reply:
            raise ChatbotUnavailableError(
                'OpenAI returned an empty reply. Please try again.'
            )

        _clear_last_error()
        return {
            'reply': reply,
            'sources': _extract_sources(response_payload),
            'provider': 'OpenAI',
            'model': get_chatbot_model()
        }
    except Exception as error:
        message = _describe_openai_error(error)
        _set_last_error(message)
        raise ChatbotUnavailableError(message) from error
