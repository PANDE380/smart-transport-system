import os
import logging

try:
    import requests
    REQUESTS_IMPORT_ERROR = None
except ImportError as import_error:
    requests = None
    REQUESTS_IMPORT_ERROR = import_error

logger = logging.getLogger(__name__)

# Sunbird AI API Configuration
# API docs: https://sunbird.ai
SUNBIRD_TRANSLATE_URL = "https://api.sunbird.ai/tasks/translate"

# Mapping ASTS language codes to Sunbird AI codes
# ASTS Keys: en, sw, lg, nk, ls, ac, at, lb
LANGUAGE_MAP = {
    'lg': 'lug',   # Luganda
    'sw': 'swa',   # Swahili
    'nk': 'nyn',   # Runyankore
    'ac': 'ach',   # Acholi
    'at': 'teo',   # Ateso
    'lb': 'lgg',   # Lugbara
    'ls': 'lug'    # Lusoga (fallback to Luganda if not directly supported)
}


class SunbirdTranslationError(Exception):
    """Base exception for Sunbird AI Translation errors."""
    pass


def translate_text(text, source_lang='en', target_lang='lg'):
    """
    Translates text using Sunbird AI.
    
    :param text: The text to translate.
    :param source_lang: Source language code (default 'en').
    :param target_lang: Target language code (default 'lg').
    :return: Translated text or original text if translation fails.
    """
    api_key = os.getenv('SUNBIRD_API_KEY', '').strip()
    if not api_key:
        logger.warning("SUNBIRD_API_KEY not configured. Returning original text.")
        return text

    if REQUESTS_IMPORT_ERROR is not None or requests is None:
        logger.warning(
            "The requests package is not installed. Returning original text."
        )
        return text

    # Map ASTS codes to Sunbird codes
    s_lang = LANGUAGE_MAP.get(source_lang, source_lang)
    t_lang = LANGUAGE_MAP.get(target_lang, target_lang)

    if s_lang == t_lang:
        return text

    payload = {
        "source_language": s_lang,
        "target_language": t_lang,
        "text": text
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(SUNBIRD_TRANSLATE_URL, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        result = response.json()
        
        # Sunbird usually returns {"translated_text": "..."}
        return result.get("translated_text", text)
    except Exception as e:
        logger.error(f"Sunbird Translation Error: {e}")
        return text


def get_sunbird_status():
    """Checks if Sunbird API is configured."""
    api_key = os.getenv('SUNBIRD_API_KEY', '').strip()
    if not api_key:
        status = "Not Configured"
        detail = "Add SUNBIRD_API_KEY to enable language translation."
    elif REQUESTS_IMPORT_ERROR is not None:
        status = "Dependency Missing"
        detail = "Install the requests package to enable Sunbird translation."
    else:
        status = "Ready"
        detail = "Sunbird translation is ready."

    return {
        "provider": "Sunbird AI",
        "configured": bool(api_key),
        "status": status,
        "detail": detail,
        "requests_available": REQUESTS_IMPORT_ERROR is None,
        "supported_languages": list(LANGUAGE_MAP.keys())
    }
