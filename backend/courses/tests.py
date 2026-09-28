from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from users.models import PasswordResetToken
from .models import Course, Enrollment, Instructor

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
