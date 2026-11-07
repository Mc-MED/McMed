"""Przypomnienia o recertyfikacji: certyfikat KPP jest ważny 3 lata od daty wystawienia,
3 miesiące przed wygaśnięciem uczestnik dostaje mail i SMS.

Uruchamiane codziennie komendą `send_recert_reminders` (cron). Każdy kanał jest odnotowywany osobno
(`recert_email_sent_at`, `recert_sms_sent_at`), więc nieudana wysyłka ponawia się następnego dnia,
a udana się nie powtarza.
"""
import calendar
import logging
from datetime import date, timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from courses.models import Enrollment
from courses.sms import send_sms
from users.emails import send_billing_email

logger = logging.getLogger(__name__)

VALIDITY_MONTHS = 36
REMIND_MONTHS_BEFORE = 3


def add_months(d, months):
    """Przesuwa datę o `months` miesięcy; 31.05 + 1 → 30.06, 29.02 + 12 → 28.02."""
    total = d.year * 12 + d.month - 1 + months
    year, month = divmod(total, 12)
    month += 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def cert_expiry(cert_date):
    return add_months(cert_date, VALIDITY_MONTHS)


def reminder_date(cert_date):
    return add_months(cert_expiry(cert_date), -REMIND_MONTHS_BEFORE)


def _renewed(enrollment):
    """Ta sama osoba ma nowszy certyfikat albo jest zapisana na późniejszy kurs — nie przypominamy."""
    person = Q(user_id=enrollment.user_id) if enrollment.user_id else Q()
    if enrollment.email:
        person |= Q(email__iexact=enrollment.email)
    if not person:
        return False
    cd = enrollment.cert_date
    return (
        Enrollment.objects.filter(person, is_deleted=False).exclude(pk=enrollment.pk)
        .filter(Q(cert_date__gt=cd) | Q(course__start_date__gt=cd) | Q(course__exam_date__gt=cd))
        .exists()
    )


def due_enrollments(today):
    """Zapisy z certyfikatem, dla którego dziś mieści się w okresie przypomnienia
    (od 3 miesięcy przed wygaśnięciem do dnia wygaśnięcia) i coś zostało do wysłania."""
    # Zakres z zapasem kilku dni na końcówki miesięcy — dokładnie sprawdza pętla niżej
    candidates = (
        Enrollment.objects.filter(
            is_deleted=False,
            cert_date__gt=add_months(today, -VALIDITY_MONTHS) - timedelta(days=4),
            cert_date__lte=add_months(today, REMIND_MONTHS_BEFORE - VALIDITY_MONTHS) + timedelta(days=4),
        )
        .filter(
            Q(recert_email_sent_at__isnull=True) & ~Q(email='')
            | Q(recert_sms_sent_at__isnull=True) & ~Q(phone='')
        )
        .select_related('course')
    )
    return [
        e for e in candidates
        if reminder_date(e.cert_date) <= today < cert_expiry(e.cert_date) and not _renewed(e)
    ]


def _fmt(d):
    return d.strftime('%d.%m.%Y')


def _link():
    return f'{settings.FRONTEND_URL}/konto'


def _send_email(to_email, first_name, cert_number, cert_date):
    """Zwraca None albo treść błędu."""
    expiry = cert_expiry(cert_date)
    cert = f' nr {cert_number}' if cert_number else ''
    body = (
        f'Twój certyfikat Kwalifikowanej Pierwszej Pomocy{cert} wystawiony {_fmt(cert_date)} '
        f'traci ważność {_fmt(expiry)} – za 3 miesiące.\n\n'
        'Aby zachować uprawnienia ratownika, przed tą datą trzeba zdać egzamin recertyfikacyjny. '
        'Terminy recertyfikacji znajdziesz po zalogowaniu na swoje konto.'
    )
    info = {'Data wystawienia': _fmt(cert_date), 'Ważny do': _fmt(expiry)}
    if cert_number:
        info = {'Numer': cert_number, **info}
    try:
        send_billing_email(
            to_email=to_email,
            first_name=first_name,
            subject='Twój certyfikat KPP wkrótce wygaśnie',
            body=body,
            course_info=info,
            button=('Zapisz się na recertyfikację', _link()),
            info_title='Certyfikat KPP',
        )
    except Exception as e:
        return f'E-mail: {e}'
    return None


def _send_sms(phone, cert_number, cert_date):
    """Zwraca None albo treść błędu."""
    cert = f' nr {cert_number}' if cert_number else ''
    ok, msg = send_sms(
        phone,
        f'Mc Med: Twoj certyfikat KPP{cert} traci waznosc {_fmt(cert_expiry(cert_date))}. '
        f'Zapisz sie na recertyfikacje: {_link()}',
    )
    return None if ok else f'SMS: {msg}'


def deliver(obj, *, first_name, cert_number, cert_date):
    """Wysyła brakujące kanały dla `obj` (Enrollment albo TestReminder: pola email, phone,
    recert_email_sent_at, recert_sms_sent_at, recert_reminder_error). Zwraca listę błędów."""
    errors = []
    fields = ['recert_reminder_error']
    if obj.email and not obj.recert_email_sent_at:
        err = _send_email(obj.email, first_name, cert_number, cert_date)
        if err:
            errors.append(err)
        else:
            obj.recert_email_sent_at = timezone.now()
            fields.append('recert_email_sent_at')
    if obj.phone and not obj.recert_sms_sent_at:
        err = _send_sms(obj.phone, cert_number, cert_date)
        if err:
            errors.append(err)
        else:
            obj.recert_sms_sent_at = timezone.now()
            fields.append('recert_sms_sent_at')
    obj.recert_reminder_error = '\n'.join(errors)
    obj.save(update_fields=fields)
    return errors


def send_reminder(enrollment):
    return deliver(enrollment, first_name=enrollment.first_name,
                   cert_number=enrollment.cert_number, cert_date=enrollment.cert_date)


def send_test_reminder(test):
    """Testowe przypomnienie: przykładowy certyfikat, który wygasa 3 miesiące po `send_on`."""
    return deliver(test, first_name='Testowy Uczestnik', cert_number='TEST/1/2024',
                   cert_date=add_months(test.send_on, REMIND_MONTHS_BEFORE - VALIDITY_MONTHS))


def reminder_status(enrollment, today):
    """Stan przypomnienia do listy w panelu admina."""
    sent = enrollment.recert_email_sent_at or enrollment.recert_sms_sent_at
    if enrollment.recert_reminder_error:
        return 'error'
    if sent:
        return 'sent'
    if today >= cert_expiry(enrollment.cert_date):
        return 'expired'
    if not enrollment.email and not enrollment.phone:
        return 'no_contact'
    if _renewed(enrollment):
        return 'renewed'
    if today < reminder_date(enrollment.cert_date):
        return 'planned'
    return 'due'


def send_due_reminders(today=None):
    """Przypomnienia uczestnikom i zaplanowane testowe. Zwraca (liczba obsłużonych, liczba z błędem)."""
    from .models import TestReminder

    today = today or timezone.localdate()
    handled = failed = 0
    tests = TestReminder.objects.filter(send_on__lte=today).filter(
        Q(recert_email_sent_at__isnull=True) & ~Q(email='')
        | Q(recert_sms_sent_at__isnull=True) & ~Q(phone='')
    )
    for obj, send in [*((e, send_reminder) for e in due_enrollments(today)),
                      *((t, send_test_reminder) for t in tests)]:
        handled += 1
        errors = send(obj)
        if errors:
            failed += 1
            logger.warning('Przypomnienie o recertyfikacji (%s %s): %s', type(obj).__name__, obj.pk, '; '.join(errors))
    return handled, failed
