"""Wystawianie proform i faktur VAT w Fakturownia.pl (https://app.fakturownia.pl/api).

FAKTUROWNIA_MODE=fake → bez połączenia z API: fikcyjne numery i prosty PDF (testy lokalne).
Funkcje zwracają (sukces: bool, dane | komunikat błędu) — jak send_sms.
"""
import datetime
import itertools
import logging
import unicodedata

import requests
from django.conf import settings

TIMEOUT = 15

logger = logging.getLogger(__name__)


def _fake():
    return getattr(settings, 'FAKTUROWNIA_MODE', 'live') == 'fake'


def _base_url():
    # Akceptuje samą subdomenę („mcmed”) albo cały adres („https://mcmed.fakturownia.pl/”)
    domain = settings.FAKTUROWNIA_DOMAIN.strip().removeprefix('https://').removeprefix('http://')
    domain = domain.split('/')[0].removesuffix('.fakturownia.pl')
    return f'https://{domain}.fakturownia.pl'


def _check_config():
    if not settings.FAKTUROWNIA_DOMAIN or not settings.FAKTUROWNIA_API_TOKEN:
        return 'Brak FAKTUROWNIA_DOMAIN lub FAKTUROWNIA_API_TOKEN w konfiguracji.'
    return ''


def _position_name(course):
    label = 'Recertyfikacja KPP' if course.course_type == 'recert' else 'Kurs Kwalifikowanej Pierwszej Pomocy'
    return f'{label} – {course.name}'


def _buyer(enrollment):
    if enrollment.invoice_company:
        return {
            'buyer_company':   True,
            'buyer_name':      enrollment.company_name,
            'buyer_tax_no':    enrollment.company_nip,
            'buyer_post_code': enrollment.company_zip_code,
            'buyer_city':      enrollment.company_city,
            'buyer_street':    enrollment.company_street,
            'buyer_email':     enrollment.email,
        }
    street = f'{enrollment.street} {enrollment.house_number}'
    if enrollment.apartment_number:
        street += f'/{enrollment.apartment_number}'
    return {
        'buyer_company':    False,
        'buyer_first_name': enrollment.first_name,
        'buyer_last_name':  enrollment.last_name,
        'buyer_name':       f'{enrollment.first_name} {enrollment.last_name}',
        'buyer_post_code':  enrollment.zip_code,
        'buyer_city':       enrollment.city,
        'buyer_street':     street,
        'buyer_email':      enrollment.email,
    }


def _document(kind, enrollment, **extra):
    today = datetime.date.today()
    doc = {
        'kind':       kind,
        'issue_date': today.isoformat(),
        'sell_date':  today.isoformat(),
        'positions':  [{
            'name':              _position_name(enrollment.course),
            'quantity':          1,
            'tax':               settings.FAKTUROWNIA_TAX,
            'total_price_gross': str(enrollment.course.price),
        }],
        **_buyer(enrollment),
        **extra,
    }
    if settings.FAKTUROWNIA_TAX == 'zw' and settings.FAKTUROWNIA_EXEMPT_REASON:
        doc['exempt_tax_kind'] = settings.FAKTUROWNIA_EXEMPT_REASON
    return doc


def _post_invoice(invoice):
    error = _check_config()
    if error:
        return False, error
    try:
        resp = requests.post(
            f'{_base_url()}/invoices.json',
            json={'api_token': settings.FAKTUROWNIA_API_TOKEN, 'invoice': invoice},
            timeout=TIMEOUT,
        )
        data = resp.json()
    except Exception as e:
        return False, f'Fakturownia: {e}'
    if resp.status_code in (200, 201) and data.get('id'):
        return True, {
            'id':       str(data['id']),
            'number':   data.get('number', ''),
            'view_url': data.get('view_url', ''),
        }
    return False, f'Fakturownia: {data.get("message") or data.get("code") or resp.text}'


_fake_counter = itertools.count(1)


def _fake_document(kind):
    n = next(_fake_counter)
    prefix = 'PRO' if kind == 'proforma' else 'FV'
    stamp = datetime.datetime.now().strftime('%H%M%S')
    return True, {'id': f'fake-{kind}-{stamp}-{n}', 'number': f'{prefix}/TEST/{stamp}/{n}', 'view_url': ''}


def create_proforma(enrollment):
    if _fake():
        return _fake_document('proforma')
    payment_to = datetime.date.today() + datetime.timedelta(days=settings.FAKTUROWNIA_PAYMENT_DAYS)
    return _post_invoice(_document('proforma', enrollment, payment_to=payment_to.isoformat()))


def create_vat(enrollment, method, proforma_id=''):
    """Faktura VAT (opłacona). Z proformą → dokument powiązany z nią w Fakturowni."""
    if _fake():
        return _fake_document('vat')
    today = datetime.date.today().isoformat()
    extra = {
        'status':       'paid',
        'paid':         str(enrollment.course.price),
        'paid_date':    today,
        'payment_to':   today,
        'payment_type': {'online': 'Przelewy24', 'cash': 'cash'}.get(method, 'transfer'),
    }
    if proforma_id and not str(proforma_id).startswith('fake-'):  # proforma z trybu testowego nie istnieje w Fakturowni
        extra['from_invoice_id'] = proforma_id
    return _post_invoice(_document('vat', enrollment, **extra))


def send_by_email(fakturownia_id, email):
    """Fakturownia wysyła dokument na podany adres (swoim szablonem maila, PDF w załączniku)."""
    if _fake() or str(fakturownia_id).startswith('fake-'):
        logger.warning('Fakturownia (tryb testowy, nie wysłano): dokument %s na %s', fakturownia_id, email)
        return True, 'ok (tryb testowy)'
    error = _check_config()
    if error:
        return False, error
    try:
        resp = requests.post(
            f'{_base_url()}/invoices/{fakturownia_id}/send_by_email.json',
            params={'api_token': settings.FAKTUROWNIA_API_TOKEN, 'email_to': email, 'email_pdf': 'true'},
            timeout=TIMEOUT,
        )
    except Exception as e:
        return False, f'Fakturownia: {e}'
    if resp.status_code == 200:
        return True, 'ok'
    return False, f'Fakturownia: nie udało się wysłać maila ({resp.status_code}): {resp.text[:200]}'


def download_pdf(fakturownia_id, number=''):
    if _fake() or str(fakturownia_id).startswith('fake-'):
        return True, _fake_pdf(number or str(fakturownia_id))
    error = _check_config()
    if error:
        return False, error
    try:
        resp = requests.get(
            f'{_base_url()}/invoices/{fakturownia_id}.pdf',
            params={'api_token': settings.FAKTUROWNIA_API_TOKEN},
            timeout=TIMEOUT,
        )
    except Exception as e:
        return False, f'Fakturownia: {e}'
    if resp.status_code == 200 and resp.content.startswith(b'%PDF'):
        return True, resp.content
    return False, f'Fakturownia: nie udało się pobrać PDF ({resp.status_code}).'


def _fake_pdf(title):
    """Jednostronicowy PDF z tekstem — zastępstwo dokumentu z Fakturowni w trybie fake."""
    text = unicodedata.normalize('NFKD', f'DOKUMENT TESTOWY {title}').encode('ascii', 'ignore').decode()
    text = text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    stream = f'BT /F1 18 Tf 60 760 Td ({text}) Tj ET'.encode()
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R '
        b'/Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    out = b'%PDF-1.4\n'
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'.encode()
    out += b''.join(f'{o:010d} 00000 n \n'.encode() for o in offsets)
    out += f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return out
