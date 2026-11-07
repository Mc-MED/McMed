from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import PasswordResetToken
from .billing import mark_paid_and_invoice
from .models import Course, Enrollment, Instructor, Invoice, Payment

User = get_user_model()


def make_enrollment(course, **kwargs):
    data = dict(
        course=course, first_name='Jan', last_name='Kowalski', email='jan@example.com', phone='500600700',
        pesel='90010112345', zip_code='30-001', city='Kraków', street='Długa', house_number='1',
    )
    data.update(kwargs)
    return Enrollment.objects.create(**data)


class InstructorPanelTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('prow@example.com', 'prow@example.com', 'haslo12345')
        self.instructor = Instructor.objects.create(first_name='Anna', last_name='Nowak', title='lek.', user=self.user)
        self.other = Instructor.objects.create(first_name='Piotr', last_name='Zieliński')

        self.own = Course.objects.create(name='Prowadzony')
        self.own.instructors.add(self.instructor)
        self.committee = Course.objects.create(name='Komisja', committee_member1='lek. Anna Nowak')
        self.foreign = Course.objects.create(name='Cudzy')
        self.foreign.instructors.add(self.other)

        self.enrollment = make_enrollment(self.own)
        self.foreign_enrollment = make_enrollment(self.foreign)
        self.client.force_authenticate(self.user)

    def test_lists_only_assigned_and_committee_courses(self):
        res = self.client.get('/api/courses/instructor/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual({c['name'] for c in res.data}, {'Prowadzony', 'Komisja'})

    def test_foreign_course_is_hidden(self):
        self.assertEqual(self.client.get(f'/api/courses/instructor/{self.foreign.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/courses/instructor/{self.foreign.pk}/enrollments/').status_code, 404)

    def test_enrollments_without_sensitive_data(self):
        make_enrollment(self.own, first_name='Usunięty', is_deleted=True)
        res = self.client.get(f'/api/courses/instructor/{self.own.pk}/enrollments/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['phone'], '500600700')
        self.assertNotIn('pesel', res.data[0])
        self.assertNotIn('payment_status', res.data[0])

    def test_committee_member_sets_only_own_practical_grades(self):
        enrollment = make_enrollment(self.committee)
        url = f'/api/courses/instructor/enrollments/{enrollment.pk}/'
        res = self.client.patch(url, {
            'exam_member1_rko': 4.5, 'exam_chair_rko': 3, 'exam_theory_grade': 2,
            'exam_committee_chair': 3, 'first_name': 'Zmieniony',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        enrollment.refresh_from_db()
        self.assertEqual(float(enrollment.exam_member1_rko), 4.5)
        self.assertIsNone(enrollment.exam_chair_rko)
        self.assertIsNone(enrollment.exam_theory_grade)
        self.assertIsNone(enrollment.exam_committee_chair)
        self.assertEqual(enrollment.first_name, 'Jan')

    def test_member_average_goes_to_own_committee_column(self):
        enrollment = make_enrollment(self.committee, exam_chair_rko=3, exam_chair_zad1=3, exam_chair_zad2=3)
        url = f'/api/courses/instructor/enrollments/{enrollment.pk}/'
        self.client.patch(url, {'exam_member1_rko': 4, 'exam_member1_zad1': 4.5}, format='json')
        res = self.client.patch(url, {'exam_member1_zad2': 4}, format='json')
        # (4 + 4,5 + 4) / 3 = 4,17 → 4
        self.assertEqual(float(res.data['exam_committee_member1']), 4)
        self.assertIsNone(res.data['exam_committee_chair'])
        # Średnie zadań od całej komisji: RKO (3 + 4) / 2 = 3,5
        self.assertEqual(float(res.data['exam_rko']), 3.5)

    def test_non_committee_instructor_cannot_grade_practical(self):
        url = f'/api/courses/instructor/enrollments/{self.enrollment.pk}/'
        res = self.client.patch(url, {'exam_chair_rko': 5, 'exam_rko': 5}, format='json')
        self.assertEqual(res.status_code, 200)
        self.enrollment.refresh_from_db()
        self.assertIsNone(self.enrollment.exam_chair_rko)
        self.assertIsNone(self.enrollment.exam_rko)

    def test_course_reports_my_committee_roles(self):
        res = self.client.get(f'/api/courses/instructor/{self.committee.pk}/')
        self.assertEqual(res.data['my_committee_roles'], ['member1'])
        res = self.client.get(f'/api/courses/instructor/{self.own.pk}/')
        self.assertEqual(res.data['my_committee_roles'], [])

    def test_grade_scale_is_validated(self):
        enrollment = make_enrollment(self.committee)
        res = self.client.patch(f'/api/courses/instructor/enrollments/{enrollment.pk}/', {'exam_member1_zad1': 2}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_cannot_grade_foreign_enrollment(self):
        res = self.client.patch(f'/api/courses/instructor/enrollments/{self.foreign_enrollment.pk}/', {'exam_chair_rko': 5}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_participant_and_anonymous_are_rejected(self):
        participant = User.objects.create_user('uczestnik@example.com', 'uczestnik@example.com', 'haslo12345')
        self.client.force_authenticate(participant)
        self.assertEqual(self.client.get('/api/courses/instructor/').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/courses/instructor/').status_code, 401)


class AdminPracticalGradesTests(TestCase):
    def test_admin_grades_for_any_member_and_committee_average_updates(self):
        client = APIClient()
        client.force_authenticate(User.objects.create_user('admin', 'a@example.com', 'x', is_staff=True))
        enrollment = make_enrollment(Course.objects.create(name='Kurs'))
        url = f'/api/courses/enrollments/{enrollment.pk}/'
        res = client.patch(url, {'exam_chair_rko': 5, 'exam_chair_zad1': 5, 'exam_chair_zad2': 4.5}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(float(res.data['exam_committee_chair']), 5)  # 4,83 → 5
        res = client.patch(url, {'exam_chair_zad1': None, 'exam_chair_rko': None, 'exam_chair_zad2': None}, format='json')
        self.assertIsNone(res.data['exam_committee_chair'])
        self.assertIsNone(res.data['exam_rko'])


class MeViewTests(TestCase):
    def test_roles(self):
        client = APIClient()
        admin = User.objects.create_user('admin', 'a@example.com', 'x', is_staff=True)
        instructor_user = User.objects.create_user('p@example.com', 'p@example.com', 'x')
        Instructor.objects.create(first_name='A', last_name='B', user=instructor_user)
        participant = User.objects.create_user('u@example.com', 'u@example.com', 'x')
        for user, role in [(admin, 'admin'), (instructor_user, 'instructor'), (participant, 'participant')]:
            client.force_authenticate(user)
            self.assertEqual(client.get('/api/users/me/').data['role'], role)


@mock.patch('courses.views.send_instructor_invite_email')
class InviteInstructorTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user('admin', 'admin@example.com', 'x', is_staff=True))
        self.instructor = Instructor.objects.create(first_name='Anna', last_name='Nowak', email='Anna@Example.com')

    def test_creates_account_and_sends_72h_link(self, send):
        res = self.client.post(f'/api/courses/instructors/{self.instructor.pk}/invite/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['has_account'])
        self.instructor.refresh_from_db()
        user = self.instructor.user
        self.assertEqual(user.username, 'anna@example.com')
        self.assertFalse(user.has_usable_password())
        token = PasswordResetToken.objects.get(user=user, is_used=False)
        self.assertGreater(token.expires_at, timezone.now() + timedelta(hours=71))
        link = send.call_args.kwargs['set_password_link']
        self.assertIn(f'/reset-hasla/{token.token}?panel=prowadzacy', link)

    def test_links_existing_account(self, send):
        existing = User.objects.create_user('anna@example.com', 'anna@example.com', 'haslo12345')
        self.client.post(f'/api/courses/instructors/{self.instructor.pk}/invite/')
        self.instructor.refresh_from_db()
        self.assertEqual(self.instructor.user, existing)
        self.assertEqual(User.objects.filter(email__iexact='anna@example.com').count(), 1)

    def test_requires_email(self, send):
        self.instructor.email = ''
        self.instructor.save()
        res = self.client.post(f'/api/courses/instructors/{self.instructor.pk}/invite/')
        self.assertEqual(res.status_code, 400)
        send.assert_not_called()

    def test_refuses_admin_account(self, send):
        User.objects.create_user('szef', 'anna@example.com', 'x', is_staff=True)
        res = self.client.post(f'/api/courses/instructors/{self.instructor.pk}/invite/')
        self.assertEqual(res.status_code, 400)
        send.assert_not_called()


class EnrollmentPositionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_superuser('admin', 'admin@example.com', 'haslo12345'))
        self.course = Course.objects.create(name='Kurs')
        self.a, self.b, self.c = (make_enrollment(self.course, last_name=n) for n in ('A', 'B', 'C'))

    def active(self):
        return [e.last_name for e in self.course.enrollments.filter(is_deleted=False)]

    def reorder(self, *enrollments):
        return self.client.post(
            f'/api/courses/admin/{self.course.pk}/enrollments/reorder/', {'order': [e.pk for e in enrollments]}, format='json',
        )

    def test_new_enrollment_goes_to_the_end(self):
        self.assertEqual([e.position for e in (self.a, self.b, self.c)], [1, 2, 3])

    def test_restored_enrollment_returns_to_its_place(self):
        self.client.post(f'/api/courses/enrollments/{self.b.pk}/remove/', {'reason': 'forfeit'}, format='json')
        self.assertEqual(self.active(), ['A', 'C'])
        self.client.post(f'/api/courses/enrollments/{self.b.pk}/restore/')
        self.assertEqual(self.active(), ['A', 'B', 'C'])

    def test_reorder(self):
        response = self.reorder(self.c, self.a, self.b)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([e['last_name'] for e in response.data], ['C', 'A', 'B'])
        self.assertEqual(self.active(), ['C', 'A', 'B'])

    def test_reorder_keeps_place_of_deleted_enrollment(self):
        self.client.post(f'/api/courses/enrollments/{self.b.pk}/remove/', {'reason': 'forfeit'}, format='json')
        self.assertEqual(self.reorder(self.c, self.a).status_code, 200)
        self.client.post(f'/api/courses/enrollments/{self.b.pk}/restore/')
        self.assertEqual(self.active(), ['C', 'B', 'A'])

    def test_reorder_rejects_incomplete_list(self):
        self.assertEqual(self.reorder(self.c, self.a).status_code, 400)
        self.assertEqual(self.active(), ['A', 'B', 'C'])

    def test_transfer_to_another_course_goes_to_the_end(self):
        other = Course.objects.create(name='Inny', max_participants=10)
        make_enrollment(other, last_name='X')
        response = self.client.patch(f'/api/courses/enrollments/{self.a.pk}/', {'course': other.pk}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([e.last_name for e in other.enrollments.all()], ['X', 'A'])

    def test_saving_grades_keeps_position(self):
        self.reorder(self.c, self.a, self.b)
        self.client.patch(f'/api/courses/enrollments/{self.c.pk}/', {'exam_chair_rko': '5'}, format='json')
        self.assertEqual(self.active(), ['C', 'A', 'B'])


@override_settings(DEBUG=True, P24_MODE='fake', FAKTUROWNIA_MODE='fake', SMS_MODE='log',
                   EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class BillingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.course = Course.objects.create(name='KPP Ełk', price='1200.00', max_participants=10)
        self.admin = User.objects.create_user('admin', 'admin@example.com', 'haslo12345', is_staff=True)

    def enroll_public(self, **extra):
        data = dict(
            course=self.course.pk, first_name='Jan', last_name='Kowalski', pesel='90010112345',
            birth_date='1990-01-01', email='jan@example.com', phone='500600700', zip_code='30-001',
            city='Kraków', street='Długa', house_number='1', password='haslo12345', terms_accepted=True,
        )
        data.update(extra)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post('/api/courses/enrollments/', data, format='json')

    def test_enrollment_issues_proforma_and_online_payment_issues_vat(self):
        resp = self.enroll_public()
        self.assertEqual(resp.status_code, 201, resp.data)
        enrollment = Enrollment.objects.get()
        proforma = enrollment.invoices.get()
        self.assertEqual(proforma.kind, Invoice.KIND_PROFORMA)
        self.assertTrue(proforma.email_sent)
        self.assertIn(str(enrollment.payment_token), resp.data['payment_url'])
        proforma_mail = mail.outbox[-1]
        self.assertIn(str(enrollment.payment_token), proforma_mail.body)
        self.assertEqual(proforma_mail.attachments[-1][2], 'application/pdf')

        token = enrollment.payment_token
        start = self.client.post(f'/api/payments/{token}/start/')
        session = start.data['redirect_url'].split('session=')[1]
        self.client.post(f'/api/payments/{token}/fake-confirm/', {'session': session, 'success': True}, format='json')
        self.client.post(f'/api/payments/{token}/fake-confirm/', {'session': session, 'success': True}, format='json')

        enrollment.refresh_from_db()
        self.assertEqual(enrollment.payment_status, 'paid')
        vat = enrollment.invoices.get(kind=Invoice.KIND_VAT)  # tylko jedna mimo dwóch potwierdzeń
        self.assertTrue(vat.email_sent and vat.sms_sent)
        self.assertEqual(len(mail.outbox), 2)  # aktywacja + proforma; fakturę VAT wysyła Fakturownia
        self.assertTrue(self.client.get(f'/api/payments/{token}/').data['paid'])

    def test_company_data_requires_valid_nip(self):
        resp = self.enroll_public(invoice_company=True, company_name='Firma', company_nip='1234567890',
                                  company_zip_code='00-001', company_city='Warszawa', company_street='Prosta 1')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('company_nip', resp.data)
        resp = self.enroll_public(invoice_company=True, company_name='Firma', company_nip='526-025-09-95',
                                  company_zip_code='00-001', company_city='Warszawa', company_street='Prosta 1')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Enrollment.objects.get().company_nip, '5260250995')

    def test_admin_marks_transfer_paid_without_proforma(self):
        enrollment = make_enrollment(self.course)
        self.client.force_authenticate(self.admin)
        resp = self.client.post(f'/api/courses/enrollments/{enrollment.pk}/mark-paid/', {'method': 'transfer'}, format='json')
        self.assertTrue(resp.data['issued'])
        rows = self.client.get(f'/api/courses/admin/{self.course.pk}/payments/').data['enrollments']
        self.assertEqual(rows[0]['paid_method'], Payment.METHOD_TRANSFER)
        self.assertIsNone(rows[0]['proforma'])
        pdf = self.client.get(f'/api/courses/invoices/{resp.data["id"]}/pdf/')
        self.assertTrue(pdf.content.startswith(b'%PDF'))

    def test_admin_marks_cash_paid_by_default(self):
        enrollment = make_enrollment(self.course)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f'/api/courses/enrollments/{enrollment.pk}/mark-paid/',
                                          {'method': 'karta'}, format='json').status_code, 400)
        self.client.post(f'/api/courses/enrollments/{enrollment.pk}/mark-paid/')
        self.assertEqual(enrollment.payments.get().method, Payment.METHOD_CASH)

    @override_settings(FAKTUROWNIA_MODE='live', FAKTUROWNIA_DOMAIN='mcmed', FAKTUROWNIA_API_TOKEN='tok')
    def test_company_enrollment_gets_company_proforma_and_invoice(self):
        def created(n):
            return mock.Mock(status_code=201, json=lambda: {'id': n, 'number': f'DOK {n}', 'view_url': ''})
        ok = mock.Mock(status_code=200, content=b'%PDF-1.4')
        with mock.patch('courses.fakturownia.requests.post', side_effect=[created(1), created(2), ok]) as post, \
             mock.patch('courses.fakturownia.requests.get', return_value=ok):
            resp = self.enroll_public(invoice_company=True, company_name='Szpital Sp. z o.o.', company_nip='526-025-09-95',
                                      company_zip_code='00-001', company_city='Warszawa', company_street='Prosta 1')
            self.assertEqual(resp.status_code, 201, resp.data)
            mark_paid_and_invoice(Enrollment.objects.get(), Payment.METHOD_CASH)
        proforma, vat = (c.kwargs['json']['invoice'] for c in post.call_args_list[:2])
        for doc in (proforma, vat):
            self.assertTrue(doc['buyer_company'])
            self.assertEqual(doc['buyer_name'], 'Szpital Sp. z o.o.')
            self.assertEqual(doc['buyer_tax_no'], '5260250995')
            self.assertEqual((doc['buyer_post_code'], doc['buyer_city'], doc['buyer_street']),
                             ('00-001', 'Warszawa', 'Prosta 1'))
        self.assertEqual((proforma['kind'], vat['kind'], vat['from_invoice_id']), ('proforma', 'vat', '1'))

    @override_settings(FAKTUROWNIA_MODE='live', FAKTUROWNIA_DOMAIN='mcmed', FAKTUROWNIA_API_TOKEN='tok')
    def test_vat_invoice_email_sent_by_fakturownia(self):
        enrollment = make_enrollment(self.course)
        created = mock.Mock(status_code=201, json=lambda: {'id': 77, 'number': 'FV 1/2026', 'view_url': ''})
        with mock.patch('courses.fakturownia.requests.post', side_effect=[created, mock.Mock(status_code=200)]) as post:
            mark_paid_and_invoice(enrollment, Payment.METHOD_CASH)
        invoice_body = post.call_args_list[0].kwargs['json']['invoice']
        self.assertEqual(invoice_body['payment_type'], 'cash')
        send = post.call_args_list[1]
        self.assertEqual(send.args[0], 'https://mcmed.fakturownia.pl/invoices/77/send_by_email.json')
        self.assertEqual(send.kwargs['params']['email_to'], enrollment.email)
        self.assertTrue(enrollment.invoices.get().email_sent)
        self.assertEqual(mail.outbox, [])

    @override_settings(P24_MODE='sandbox', P24_MERCHANT_ID='1', P24_CRC='crc', P24_API_KEY='key')
    def test_sandbox_payment_does_not_mark_paid_or_invoice(self):
        enrollment = make_enrollment(self.course)
        payment = Payment.objects.create(enrollment=enrollment, session_id='s1', amount=120000)
        with mock.patch('courses.przelewy24.notification_valid', return_value=True), \
             mock.patch('courses.przelewy24.verify', return_value=(True, '')):
            resp = self.client.post('/api/payments/p24/notify/',
                                    {'sessionId': 's1', 'amount': 120000, 'orderId': 9}, format='json')
        self.assertEqual(resp.status_code, 200)
        payment.refresh_from_db()
        enrollment.refresh_from_db()
        self.assertEqual(payment.status, Payment.STATUS_TEST)
        self.assertNotEqual(enrollment.payment_status, 'paid')
        self.assertFalse(enrollment.invoices.exists())
        info = self.client.get(f'/api/payments/{enrollment.payment_token}/').data
        self.assertTrue(info['test_payment'])
        self.assertFalse(info['paid'])

    @override_settings(DEBUG=False)
    def test_fake_confirm_disabled_outside_debug(self):
        enrollment = make_enrollment(self.course)
        resp = self.client.post(f'/api/payments/{enrollment.payment_token}/fake-confirm/', {'session': 'x'})
        self.assertEqual(resp.status_code, 404)


class TermsAcceptanceTests(TestCase):
    """Zapis na kurs wymaga akceptacji regulaminu; data akceptacji trafia do bazy."""

    def setUp(self):
        self.client = APIClient()
        self.course = Course.objects.create(name='KPP Ełk', price='1200.00', max_participants=10)

    def enroll_public(self, **extra):
        data = dict(
            course=self.course.pk, first_name='Jan', last_name='Kowalski', pesel='90010112345',
            birth_date='1990-01-01', email='jan@example.com', phone='500600700', zip_code='30-001',
            city='Kraków', street='Długa', house_number='1', password='haslo12345',
        )
        data.update(extra)
        return self.client.post('/api/courses/enrollments/', data, format='json')

    def test_public_enrollment_requires_terms(self):
        resp = self.enroll_public()
        self.assertEqual(resp.status_code, 400)
        self.assertIn('terms_accepted', resp.data)
        self.assertEqual(self.enroll_public(terms_accepted=False).status_code, 400)
        self.assertFalse(Enrollment.objects.exists())

    def test_public_enrollment_stores_acceptance_time(self):
        resp = self.enroll_public(terms_accepted=True)
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertNotIn('terms_accepted', resp.data)
        self.assertIsNotNone(Enrollment.objects.get().terms_accepted_at)

    def test_enroll_me_requires_terms(self):
        user = User.objects.create_user('jan@example.com', 'jan@example.com', 'haslo12345')
        old_course = Course.objects.create(name='Stary', price='1000.00', course_days=['2025-01-10', '2025-01-11'])
        make_enrollment(old_course, user=user)  # zakończony kurs — szybki zapis bierze z niego dane
        self.client.force_authenticate(user)
        resp = self.client.post('/api/courses/enroll-me/', {'course': self.course.pk}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('terms_accepted', resp.data)
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post('/api/courses/enroll-me/', {'course': self.course.pk, 'terms_accepted': True}, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertIsNotNone(Enrollment.objects.get(course=self.course).terms_accepted_at)

    def test_admin_added_enrollment_has_no_acceptance(self):
        self.assertIsNone(make_enrollment(self.course).terms_accepted_at)


class SendEmailAttachmentsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user('admin', 'admin@example.com', 'x', is_staff=True))
        course = Course.objects.create(name='Kurs')
        self.first = make_enrollment(course, email='a@example.com')
        self.second = make_enrollment(course, email='b@example.com')

    def test_attachments_go_to_every_recipient(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        res = self.client.post('/api/courses/enrollments/send-email/', {
            'enrollment_ids': [self.first.id, self.second.id],
            'subject': 'Materiały',
            'body': 'W załączniku materiały.',
            'attachments': [
                SimpleUploadedFile('plan.pdf', b'%PDF-1.4 plan', content_type='application/pdf'),
                SimpleUploadedFile('lista.txt', b'lista', content_type='text/plain'),
            ],
        }, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['sent'], 2)
        self.assertEqual(len(mail.outbox), 2)
        for msg in mail.outbox:
            files = [a for a in msg.attachments if isinstance(a, tuple)]
            self.assertEqual([(n, c) for n, c, _ in files], [('plan.pdf', b'%PDF-1.4 plan'), ('lista.txt', 'lista')])

    def test_json_without_attachments_still_works(self):
        res = self.client.post('/api/courses/enrollments/send-email/', {
            'enrollment_ids': [self.first.id], 'subject': 'Temat', 'body': 'Treść',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['sent'], 1)
