import re
import requests
from django.conf import settings

SMSAPI_URL = 'https://api.smsapi.pl/sms.do'


def _normalize_phone(phone: str) -> str | None:
    """Zwraca numer w formacie 48XXXXXXXXX lub None jeśli niepoprawny."""
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 9:
        return '48' + digits
    if len(digits) == 11 and digits.startswith('48'):
        return digits
    if len(digits) == 12 and digits.startswith('048'):
        return digits[1:]
    if len(digits) == 13 and digits.startswith('0048'):
        return digits[2:]
    return None


def send_sms(phone: str, message: str) -> tuple[bool, str]:
    """
    Wysyła SMS przez SMSAPI.pl.
    Zwraca (sukces: bool, komunikat: str).
    """
    token = getattr(settings, 'SMS_API_TOKEN', '')
    if not token:
        return False, 'Brak tokenu SMS_API_TOKEN w konfiguracji.'

    normalized = _normalize_phone(phone)
    if not normalized:
        return False, f'Niepoprawny numer telefonu: {phone}'

    sender = getattr(settings, 'SMS_API_SENDER', 'McMed')

    try:
        resp = requests.post(
            SMSAPI_URL,
            headers={'Authorization': f'Bearer {token}'},
            data={
                'to': normalized,
                'message': message,
                'from': sender,
                'format': 'json',
            },
            timeout=10,
        )
        data = resp.json()
    except Exception as e:
        return False, str(e)

    if resp.status_code == 200 and data.get('count', 0) > 0:
        return True, 'ok'

    error_msg = data.get('message') or data.get('error') or resp.text
    return False, str(error_msg)
