import os
from datetime import datetime, timezone

try:
    from openai import APIConnectionError, AuthenticationError, OpenAI, OpenAIError
    from openai import RateLimitError
    OPENAI_IMPORT_ERROR = None
except ImportError as import_error:
    APIConnectionError = AuthenticationError = OpenAIError = RateLimitError = Exception
    OpenAI = None
    OPENAI_IMPORT_ERROR = import_error


DEFAULT_CHATBOT_MODEL = 'gpt-5.4-mini'
ERROR_COOLDOWN_SECONDS = 60
_openai_client = None
_last_error_message = None
_last_error_at = None


SYSTEM_PROMPT = """
You are the OpenAI-powered assistant for A Smart Transport System Uganda (ASTS).

Your job:
- Help users with ASTS transport, booking, driver, wallet, payment, safety, tracking, and support questions.
- You may also answer general knowledge questions clearly and helpfully.
- When a user asks for account-specific data that you cannot directly inspect, say that clearly and guide them to the right ASTS page or support path.
- Keep answers practical, warm, and easy to understand.
- Do not invent internal policies, balances, bookings, or live account data.
- If web search is enabled and you rely on it, keep the answer concise and grounded in the cited sources.
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
        return 'The OpenAI API key was rejected. Check the configured key and try again.'
    if isinstance(error, RateLimitError):
        return (
            'OpenAI is unavailable because the current API quota or rate limit was reached. '
            'Check billing and usage, then try again.'
        )
    if isinstance(error, APIConnectionError):
        return 'The OpenAI service could not be reached. Check internet access and try again.'
    if isinstance(error, OpenAIError):
        return f'OpenAI returned an API error: {error}'
    return f'OpenAI is temporarily unavailable: {error}'


def _build_input_items(message, history):
    input_items = [
        {
            'role': 'system',
            'content': [{'type': 'input_text', 'text': SYSTEM_PROMPT}]
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
        'ready': OPENAI_IMPORT_ERROR is None and configured and cooldown_remaining == 0,
        'status': status,
        'status_label': label,
        'detail': detail,
        'web_search_enabled': is_web_search_enabled(),
        'cooldown_seconds_remaining': cooldown_remaining,
        'last_error': _last_error_message
    }


def generate_chatbot_reply(message, history=None):
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
        'input': _build_input_items(message, history or []),
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
