from datetime import date
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from courses.models import Course
from courses.tests import make_enrollment
from .models import TestReminder
from .reminders import add_months, cert_expiry, reminder_date, send_due_reminders

TODAY = date(2026, 10, 29)


class DatesTests(TestCase):
    def test_add_months_clamps_month_end(self):
        self.assertEqual(add_months(date(2026, 5, 31), 1), date(2026, 6, 30))
        self.assertEqual(add_months(date(2024, 2, 29), 36), date(2027, 2, 28))
        self.assertEqual(add_months(date(2026, 1, 15), -3), date(2025, 10, 15))

    def test_expiry_and_reminder(self):
        self.assertEqual(cert_expiry(date(2024, 1, 29)), date(2027, 1, 29))
        self.assertEqual(reminder_date(date(2024, 1, 29)), date(2026, 10, 29))


@override_settings(SMS_MODE='log', FRONTEND_URL='https://mcmed.pl')
class RecertReminderTests(TestCase):
    def setUp(self):
        self.course = Course.objects.create(name='KPP styczeń 2024')

    def test_sends_email_and_sms_once(self):
        e = make_enrollment(self.course, cert_date=date(2024, 1, 29), cert_number='KPP/7/2024')
        with mock.patch('notifications.reminders.send_sms', return_value=(True, 'ok')) as sms:
            self.assertEqual(send_due_reminders(TODAY), (1, 0))
            self.assertEqual(send_due_reminders(TODAY), (0, 0))

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('29.01.2027', mail.outbox[0].body)
        self.assertIn('https://mcmed.pl/konto', mail.outbox[0].body)
        sms.assert_called_once()
        self.assertIn('KPP/7/2024', sms.call_args.args[1])
        e.refresh_from_db()
        self.assertIsNotNone(e.recert_email_sent_at)
        self.assertIsNotNone(e.recert_sms_sent_at)

    def test_outside_window(self):
        make_enrollment(self.course, cert_date=date(2024, 1, 30))   # przypomnienie dopiero jutro
        make_enrollment(self.course, cert_date=date(2023, 10, 29))  # już wygasł
        self.assertEqual(send_due_reminders(TODAY), (0, 0))

    def test_failed_sms_retried_next_day_without_resending_email(self):
        e = make_enrollment(self.course, cert_date=date(2024, 1, 29))
        with mock.patch('notifications.reminders.send_sms', return_value=(False, 'brak środków')):
            self.assertEqual(send_due_reminders(TODAY), (1, 1))
        e.refresh_from_db()
        self.assertIn('brak środków', e.recert_reminder_error)

        with mock.patch('notifications.reminders.send_sms', return_value=(True, 'ok')) as sms:
            self.assertEqual(send_due_reminders(date(2026, 10, 30)), (1, 0))
        sms.assert_called_once()
        self.assertEqual(len(mail.outbox), 1)
        e.refresh_from_db()
        self.assertEqual(e.recert_reminder_error, '')

    def test_skips_person_who_already_renewed(self):
        make_enrollment(self.course, cert_date=date(2024, 1, 29))
        recert = Course.objects.create(name='Recert', course_type=Course.TYPE_RECERT, exam_date=date(2026, 12, 5))
        make_enrollment(recert, email='JAN@example.com')
        self.assertEqual(send_due_reminders(TODAY), (0, 0))

    def test_skips_deleted_enrollment(self):
        make_enrollment(self.course, cert_date=date(2024, 1, 29), is_deleted=True)
        self.assertEqual(send_due_reminders(TODAY), (0, 0))


@override_settings(SMS_MODE='log', FRONTEND_URL='https://mcmed.pl')
class TestReminderTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        admin = get_user_model().objects.create_user('admin', 'a@example.com', 'x', is_staff=True)
        self.client.force_authenticate(admin)

    def test_cron_sends_scheduled_test_on_its_day(self):
        resp = self.client.post('/api/notifications/recert-reminders/tests/',
                                {'email': 'ja@example.com', 'phone': '500600700', 'send_on': '2099-01-10'})
        self.assertEqual(resp.status_code, 201)
        with mock.patch('notifications.reminders.send_sms', return_value=(True, 'ok')) as sms:
            self.assertEqual(send_due_reminders(date(2099, 1, 9)), (0, 0))
            self.assertEqual(send_due_reminders(date(2099, 1, 10)), (1, 0))
            self.assertEqual(send_due_reminders(date(2099, 1, 11)), (0, 0))
        sms.assert_called_once()
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['ja@example.com'])
        self.assertIn('10.04.2099', mail.outbox[0].body)  # wygasa 3 miesiące po dacie wysyłki

    def test_send_now_and_validation(self):
        self.assertEqual(self.client.post('/api/notifications/recert-reminders/tests/',
                                          {'send_on': '2099-01-10'}).status_code, 400)
        self.assertEqual(self.client.post('/api/notifications/recert-reminders/tests/',
                                          {'phone': '123', 'send_on': '2099-01-10'}).status_code, 400)
        test = TestReminder.objects.create(email='ja@example.com', send_on=date(2099, 1, 10))
        resp = self.client.post(f'/api/notifications/recert-reminders/tests/{test.id}/send/')
        self.assertIsNotNone(resp.data['email_sent_at'])
        self.assertEqual(len(mail.outbox), 1)

    def test_list(self):
        make_enrollment(Course.objects.create(name='K'), cert_date=date(2024, 1, 29))
        rows = self.client.get('/api/notifications/recert-reminders/').data['rows']
        self.assertEqual(rows[0]['reminder_date'], date(2026, 10, 29))
        self.assertIn(rows[0]['status'], STATUSES)


STATUSES = {'planned', 'due', 'sent', 'error', 'renewed', 'expired', 'no_contact'}


class SendingHoursTests(TestCase):
    def run_at(self, hour):
        from datetime import datetime
        from io import StringIO
        from zoneinfo import ZoneInfo
        from django.core.management import call_command

        at = datetime(2026, 11, 8, hour, 30, tzinfo=ZoneInfo('Europe/Warsaw'))
        out = StringIO()
        with mock.patch('django.utils.timezone.localtime', return_value=at), \
             mock.patch('notifications.management.commands.send_recert_reminders.send_due_reminders',
                        return_value=(0, 0)) as send:
            call_command('send_recert_reminders', stdout=out)
        return send.called

    def test_nothing_sent_at_night(self):
        for hour in (20, 23, 0, 7):
            self.assertFalse(self.run_at(hour), hour)

    def test_sends_during_day(self):
        for hour in (8, 12, 19):
            self.assertTrue(self.run_at(hour), hour)
