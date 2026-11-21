"""Proforma przy zapisie, faktura VAT po wpłacie, wysyłka mail + SMS.

Proformę wysyłamy własnym mailem (z linkiem „Zapłać online”), fakturę VAT wysyła mailem Fakturownia.

Błąd Fakturowni, maila czy SMS-a nigdy nie przerywa zapisu ani potwierdzenia płatności —
trafia do Invoice.send_error i jest widoczny w panelu admina (Płatności).
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from users.emails import send_billing_email

from . import fakturownia
from .models import Course, Enrollment, Invoice, Payment
from .sms import send_sms

logger = logging.getLogger(__name__)


# Płatność online starsza niż to okno bez potwierdzenia z P24 nie jest już pokazywana jako „w toku”
PENDING_WINDOW = timedelta(minutes=30)


def amount_due(enrollment):
    """Kwota do zapłaty: z wystawionej proformy (to ją dostał klient), bez proformy — aktualna cena kursu."""
    proforma = enrollment.invoices.filter(kind=Invoice.KIND_PROFORMA).exclude(fakturownia_id='').first()
    return proforma.amount_gross if proforma else enrollment.course.price


def to_grosze(amount):
    return int((Decimal(amount) * 100).quantize(Decimal('1')))


def is_recent_pending(payment, now=None):
    return (payment.method == Payment.METHOD_ONLINE and payment.status == Payment.STATUS_PENDING
            and payment.created_at >= (now or timezone.now()) - PENDING_WINDOW)


def overpayment(payments):
    """Wpłaty ponad pierwszą opłaconą (np. dwie płatności online albo online + gotówka) — do zwrotu."""
    paid = sorted((p for p in payments if p.status == Payment.STATUS_PAID),
                  key=lambda p: (p.paid_at or p.created_at, p.created_at))
    return paid[1:]


def payment_link(enrollment):
    return f'{settings.FRONTEND_URL}/platnosc/{enrollment.payment_token}'


def _course_info(course):
    def fmt(d):
        return d.strftime('%d.%m.%Y') if d else '–'

    if course.course_type == Course.TYPE_RECERT:
        termin = fmt(course.exam_date)
    else:
        termin = f'{fmt(course.start_date)} – {fmt(course.end_date)}'
    return {'Kurs': course.name, 'Termin': termin, 'Miejsce': course.city, 'Kwota': f'{course.price} zł'}


def _filename(invoice):
    return f'{invoice.number or invoice.get_kind_display()}.pdf'.replace('/', '-')


def send_invoice(invoice):
    """Proforma: nasz mail z PDF i linkiem do płatności. Faktura VAT: mail z Fakturowni + SMS.

    Wynik zapisuje w invoice.
    """
    enrollment = invoice.enrollment
    course = enrollment.course
    errors = []

    if enrollment.email and invoice.kind == Invoice.KIND_VAT:
        ok, msg = fakturownia.send_by_email(invoice.fakturownia_id, enrollment.email)
        if ok:
            invoice.email_sent = True
        else:
            errors.append(f'E-mail: {msg}')
    elif enrollment.email:
        ok, pdf = fakturownia.download_pdf(invoice.fakturownia_id, invoice.number)
        if not ok:
            errors.append(pdf)
        else:
            subject = f'Proforma {invoice.number} – {course.name}'
            body = (
                f'w załączniku przesyłamy fakturę proforma nr {invoice.number} za udział w kursie.\n'
                f'Kwota do zapłaty: {invoice.amount_gross} zł.\n\n'
                'Za kurs możesz zapłacić online przez Przelewy24 – kliknij przycisk poniżej '
                'albo na miejscu, na kursie. Po wpłacie otrzymasz fakturę VAT.'
            )
            button = ('Zapłać online', payment_link(enrollment))
            try:
                send_billing_email(
                    to_email=enrollment.email,
                    first_name=enrollment.first_name,
                    subject=subject,
                    body=body,
                    course_info=_course_info(course),
                    button=button,
                    attachment=(_filename(invoice), pdf),
                )
                invoice.email_sent = True
            except Exception as e:
                errors.append(f'E-mail: {e}')

    if invoice.kind == Invoice.KIND_VAT and enrollment.phone:
        ok, msg = send_sms(
            enrollment.phone,
            f'Mc Med: dziekujemy za wplate za kurs {course.name}. '
            f'Faktura nr {invoice.number} zostala wyslana na Twoj e-mail.',
        )
        if ok:
            invoice.sms_sent = True
        else:
            errors.append(f'SMS: {msg}')

    invoice.send_error = '\n'.join(errors)
    invoice.save(update_fields=['email_sent', 'sms_sent', 'send_error'])
    return not errors


def issue_proforma(enrollment):
    """Proforma na pełną cenę kursu + mail z linkiem do płatności. Nie wystawia drugiej."""
    if enrollment.invoices.filter(kind=Invoice.KIND_PROFORMA).exclude(fakturownia_id='').exists():
        return None
    ok, data = fakturownia.create_proforma(enrollment)
    # Poprzednia nieudana próba — nadpisujemy ją zamiast dokładać kolejną
    invoice = enrollment.invoices.filter(kind=Invoice.KIND_PROFORMA).first() or Invoice(
        enrollment=enrollment, kind=Invoice.KIND_PROFORMA)
    invoice.amount_gross = enrollment.course.price
    if not ok:
        logger.error('Proforma dla zapisu %s: %s', enrollment.pk, data)
        invoice.send_error = data
        invoice.save()
        return invoice
    invoice.fakturownia_id = data['id']
    invoice.number = data['number']
    invoice.view_url = data['view_url']
    invoice.send_error = ''
    invoice.save()
    send_invoice(invoice)
    return invoice


def issue_proforma_on_commit(enrollment):
    """Do wywołania przy zapisie — proforma powstaje dopiero po zatwierdzeniu transakcji."""
    def run():
        try:
            issue_proforma(enrollment)
        except Exception:
            logger.exception('Proforma dla zapisu %s', enrollment.pk)
    transaction.on_commit(run)


def mark_paid_and_invoice(enrollment, method, payment=None):
    """Opłacenie zapisu: status, faktura VAT (z proformy, jeśli jest), mail + SMS.

    Idempotentne — gdy faktura VAT już istnieje, niczego nie wystawia ponownie.
    Faktura jest na kwotę faktycznej wpłaty (online: z P24, ręcznie: z proformy / ceny kursu).
    Kolejna wpłata za opłacony zapis zostaje zapisana — panel Płatności pokazuje ją jako nadpłatę.
    """
    with transaction.atomic():
        enrollment = Enrollment.objects.select_for_update().get(pk=enrollment.pk)
        if payment is None:
            payment = Payment.objects.create(
                enrollment=enrollment,
                session_id=f'{method}-{enrollment.pk}-{timezone.now():%Y%m%d%H%M%S%f}',
                amount=to_grosze(amount_due(enrollment)),
                method=method,
            )
        already_paid = enrollment.payments.filter(status=Payment.STATUS_PAID).exclude(pk=payment.pk).exists()
        if already_paid and payment.status != Payment.STATUS_PAID:
            logger.warning('Nadpłata: zapis %s był już opłacony, kolejna wpłata %s (%s gr) — do zwrotu',
                           enrollment.pk, payment.session_id, payment.amount)
        if payment.status != Payment.STATUS_PAID:
            payment.status = Payment.STATUS_PAID
            payment.paid_at = timezone.now()
            payment.save(update_fields=['status', 'paid_at'])
        if enrollment.payment_status != 'paid':
            enrollment.payment_status = 'paid'
            enrollment.save(update_fields=['payment_status'])

        existing = enrollment.invoices.filter(kind=Invoice.KIND_VAT).exclude(fakturownia_id='').first()
        if existing:
            return existing

        # Faktura na pierwszą opłaconą wpłatę (przy ponowieniu nieudanego wystawienia też na nią)
        first_paid = enrollment.payments.filter(status=Payment.STATUS_PAID).order_by('paid_at', 'created_at').first()
        amount = (Decimal(first_paid.amount) / 100).quantize(Decimal('0.01'))
        proforma = enrollment.invoices.filter(kind=Invoice.KIND_PROFORMA).exclude(fakturownia_id='').first()
        ok, data = fakturownia.create_vat(enrollment, first_paid.method, proforma.fakturownia_id if proforma else '',
                                          amount=amount)
        # Poprzednia nieudana próba wystawienia faktury — nadpisujemy ją zamiast dokładać kolejną
        invoice = enrollment.invoices.filter(kind=Invoice.KIND_VAT).first() or Invoice(
            enrollment=enrollment, kind=Invoice.KIND_VAT)
        invoice.amount_gross = amount
        if not ok:
            logger.error('Faktura VAT dla zapisu %s: %s', enrollment.pk, data)
            invoice.send_error = data
            invoice.save()
            return invoice
        invoice.fakturownia_id = data['id']
        invoice.number = data['number']
        invoice.view_url = data['view_url']
        invoice.send_error = ''
        invoice.save()

    send_invoice(invoice)
    return invoice


def mark_refunded(payment):
    """Admin zwrócił nadpłatę. Pierwsza opłacona wpłata zapisu (ta pod fakturą) nie może zostać zwrócona."""
    with transaction.atomic():
        enrollment = Enrollment.objects.select_for_update().get(pk=payment.enrollment_id)
        if payment not in overpayment(enrollment.payments.all()):
            return False
        payment.status = Payment.STATUS_REFUNDED
        payment.save(update_fields=['status'])
        return True


def retry(invoice):
    """Przycisk „Wyślij ponownie”: dokument niewystawiony → ponowne wystawienie, wystawiony → ponowna wysyłka."""
    if invoice.fakturownia_id:
        send_invoice(invoice)
    elif invoice.kind == Invoice.KIND_PROFORMA:
        issue_proforma(invoice.enrollment)
    else:
        payment = invoice.enrollment.payments.filter(status=Payment.STATUS_PAID).first()
        mark_paid_and_invoice(invoice.enrollment, payment.method if payment else Payment.METHOD_TRANSFER, payment)
    invoice.refresh_from_db()
    return invoice
