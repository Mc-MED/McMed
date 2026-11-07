"""Płatności online Przelewy24 (REST API v1).

P24_MODE: fake (lokalna symulacja, bez połączenia z P24), sandbox, production.
"""
import hashlib
import json

import requests
from django.conf import settings

TIMEOUT = 15


def mode():
    return getattr(settings, 'P24_MODE', 'fake')


def _host():
    return 'https://sandbox.przelewy24.pl' if mode() == 'sandbox' else 'https://secure.przelewy24.pl'


def _sign(fields):
    payload = json.dumps(fields, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha384(payload.encode()).hexdigest()


def _auth():
    return (str(settings.P24_POS_ID), settings.P24_API_KEY)


def _ids():
    return int(settings.P24_MERCHANT_ID), int(settings.P24_POS_ID or settings.P24_MERCHANT_ID)


def register(payment, *, description, email, url_return, url_status):
    """Rejestruje transakcję. Zwraca (True, adres przekierowania) albo (False, komunikat)."""
    if not settings.P24_MERCHANT_ID or not settings.P24_CRC or not settings.P24_API_KEY:
        return False, 'Brak danych Przelewy24 (P24_MERCHANT_ID, P24_CRC, P24_API_KEY) w konfiguracji.'
    merchant_id, pos_id = _ids()
    body = {
        'merchantId':  merchant_id,
        'posId':       pos_id,
        'sessionId':   payment.session_id,
        'amount':      payment.amount,
        'currency':    'PLN',
        'description': description[:1024],
        'email':       email,
        'country':     'PL',
        'language':    'pl',
        'urlReturn':   url_return,
        'urlStatus':   url_status,
        'sign': _sign({
            'sessionId':  payment.session_id,
            'merchantId': merchant_id,
            'amount':     payment.amount,
            'currency':   'PLN',
            'crc':        settings.P24_CRC,
        }),
    }
    try:
        resp = requests.post(f'{_host()}/api/v1/transaction/register', json=body, auth=_auth(), timeout=TIMEOUT)
        data = resp.json()
    except Exception as e:
        return False, f'Przelewy24: {e}'
    token = (data.get('data') or {}).get('token')
    if resp.status_code == 200 and token:
        return True, f'{_host()}/trnRequest/{token}'
    return False, f'Przelewy24: {data.get("error") or resp.text}'


def notification_valid(n):
    """Sprawdza podpis powiadomienia (urlStatus) od Przelewy24."""
    try:
        expected = _sign({
            'merchantId':   int(n['merchantId']),
            'posId':        int(n['posId']),
            'sessionId':    n['sessionId'],
            'amount':       int(n['amount']),
            'originAmount': int(n['originAmount']),
            'currency':     n['currency'],
            'orderId':      int(n['orderId']),
            'methodId':     int(n['methodId']),
            'statement':    n['statement'],
            'crc':          settings.P24_CRC,
        })
    except (KeyError, TypeError, ValueError):
        return False
    return expected == n.get('sign')


def verify(payment, order_id):
    """Potwierdza transakcję w P24 — dopiero po tym płatność jest zaksięgowana."""
    merchant_id, pos_id = _ids()
    body = {
        'merchantId': merchant_id,
        'posId':      pos_id,
        'sessionId':  payment.session_id,
        'amount':     payment.amount,
        'currency':   'PLN',
        'orderId':    int(order_id),
        'sign': _sign({
            'sessionId': payment.session_id,
            'orderId':   int(order_id),
            'amount':    payment.amount,
            'currency':  'PLN',
            'crc':       settings.P24_CRC,
        }),
    }
    try:
        resp = requests.put(f'{_host()}/api/v1/transaction/verify', json=body, auth=_auth(), timeout=TIMEOUT)
        data = resp.json()
    except Exception as e:
        return False, f'Przelewy24: {e}'
    if resp.status_code == 200 and (data.get('data') or {}).get('status') == 'success':
        return True, 'ok'
    return False, f'Przelewy24: {data.get("error") or resp.text}'
