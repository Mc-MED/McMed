from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from .models import Course, Enrollment, Instructor
from .serializers import CourseSerializer, AdminCourseSerializer, EnrollmentSerializer, InstructorSerializer, MyEnrollmentSerializer
from users.emails import send_activation_email, send_course_email

User = get_user_model()


class PublicCourseListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class   = CourseSerializer

    def get_queryset(self):
        today = timezone.now().date()
        return Course.objects.filter(is_active=True).filter(
            Q(course_type=Course.TYPE_RECERT, exam_date__gte=today)
            | Q(course_type=Course.TYPE_RECERT, exam_date__isnull=True)
            | Q(course_type=Course.TYPE_KPP, end_date__gte=today)
            | Q(course_type=Course.TYPE_KPP, end_date__isnull=True)
        )


class PublicEnrollView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class   = EnrollmentSerializer

    def create(self, request, *args, **kwargs):
        password = request.data.get('password', '')

        if len(password) < 8:
            return Response({'password': 'Hasło musi mieć min. 8 znaków.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        vd = serializer.validated_data
        email      = vd.get('email', '')
        first_name = vd.get('first_name', '')
        last_name  = vd.get('last_name', '')

        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            if existing.is_active:
                msg = 'Posiadasz już konto w systemie. Zaloguj się, aby zapisać się na kolejny kurs.'
                return Response(
                    {'email': msg, 'email_exists': True, 'account_active': True},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            else:
                msg = 'Konto z tym adresem e-mail już istnieje, ale nie zostało jeszcze aktywowane. Sprawdź skrzynkę mailową.'
                return Response(
                    {'email': msg, 'email_exists': True, 'account_active': False},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            user = User.objects.create_user(
                username=email.lower(),
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_active=False,
            )
            from users.models import ActivationToken
            activation = ActivationToken.objects.create(user=user)
            enrollment = serializer.save(user=user)

        self._send_enrollment_email(enrollment, activation.token)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def _send_enrollment_email(self, enrollment, token):
        if not enrollment.email:
            return

        course = enrollment.course
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

        def fmt(d):
            return d.strftime('%d.%m.%Y') if d else '–'

        course_info = {
            'Kurs':    course.name,
            'Termin':  f'{fmt(course.start_date)} – {fmt(course.end_date)}',
            'Miejsce': course.city,
            'Cena':    f'{course.price} zł',
        }

        _MONTHS_PL = ['', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
                      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
        if course.start_date:
            month_pl = _MONTHS_PL[course.start_date.month]
            year = course.start_date.year
        else:
            month_pl, year = '', ''
        course_label = (
            'Kurs Kwalifikowanej Pierwszej Pomocy'
            if course.course_type == 'kpp' else
            'Recertyfikacja KPP'
        )
        payment_title = (
            f'{enrollment.first_name} {enrollment.last_name} '
            f'{course_label} - zaliczka, {month_pl} - {course.city} {year}'
        )

        send_activation_email(
            to_email=enrollment.email,
            first_name=enrollment.first_name,
            activation_link=f'{frontend_url}/aktywuj/{token}',
            course_info=course_info,
            payment_title=payment_title,
        )


class AdminCourseListView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class   = AdminCourseSerializer
    queryset           = Course.objects.all()


class AdminCourseCreateView(generics.CreateAPIView):
    permission_classes = [IsAdminUser]
    serializer_class   = AdminCourseSerializer


class AdminCourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    serializer_class   = AdminCourseSerializer
    queryset           = Course.objects.all()
    http_method_names  = ['get', 'patch', 'delete']


class AdminEnrollmentListView(generics.ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class   = EnrollmentSerializer

    def get_queryset(self):
        qs = Enrollment.objects.select_related('course')
        deleted    = self.request.query_params.get('deleted')
        unassigned = self.request.query_params.get('unassigned')
        course_id  = self.request.query_params.get('course')
        if deleted:
            return qs.filter(is_deleted=True)
        qs = qs.filter(is_deleted=False)
        if unassigned:
            return qs.filter(course__isnull=True)
        qs = qs.filter(course__isnull=False)
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs


class AdminEnrollmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    serializer_class   = EnrollmentSerializer
    queryset           = Enrollment.objects.all()
    http_method_names  = ['get', 'patch', 'delete']

    def perform_destroy(self, instance):
        user = instance.user
        instance.delete()
        # Jeśli user nie ma innych zapisów, usuń jego konto – inaczej blokuje ponowną rejestrację
        if user and not user.enrollments.filter(is_deleted=False).exists():
            user.delete()


class InstructorListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    serializer_class   = InstructorSerializer
    queryset           = Instructor.objects.all()


class InstructorDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    serializer_class   = InstructorSerializer
    queryset           = Instructor.objects.all()


@api_view(['POST'])
@permission_classes([IsAdminUser])
def soft_delete_enrollment(request, pk):
    try:
        enrollment = Enrollment.objects.get(pk=pk, is_deleted=False)
    except Enrollment.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    reason = request.data.get('reason', '')
    enrollment.is_deleted = True
    enrollment.deleted_at = timezone.now()
    enrollment.deletion_reason = reason
    enrollment.save()
    return Response(EnrollmentSerializer(enrollment).data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def anonymize_enrollment(request, pk):
    updated = Enrollment.objects.filter(pk=pk).update(
        pesel='',
        birth_date=None,
        phone='',
        zip_code='',
        city='',
        street='',
        house_number='',
        apartment_number='',
    )
    if not updated:
        return Response(status=status.HTTP_404_NOT_FOUND)
    enrollment = Enrollment.objects.select_related('course').get(pk=pk)
    return Response(EnrollmentSerializer(enrollment).data)


class MyProfileView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        has_previous = Enrollment.objects.filter(user=request.user).exists()
        enrollment = (
            Enrollment.objects
            .filter(user=request.user, is_deleted=False)
            .order_by('-created_at')
            .first()
        )
        if not enrollment:
            return Response({'has_previous': has_previous})
        return Response({
            'has_previous':     True,
            'first_name':       enrollment.first_name,
            'last_name':        enrollment.last_name,
            'birth_date':       str(enrollment.birth_date) if enrollment.birth_date else None,
            'email':            enrollment.email,
            'phone':            enrollment.phone,
            'zip_code':         enrollment.zip_code,
            'city':             enrollment.city,
            'street':           enrollment.street,
            'house_number':     enrollment.house_number,
            'apartment_number': enrollment.apartment_number,
            'photo_consent':    enrollment.photo_consent,
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enroll_me(request):
    course_id = request.data.get('course')
    if not course_id:
        return Response({'course': 'Wybierz kurs.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        course = Course.objects.get(pk=course_id, is_active=True)
    except Course.DoesNotExist:
        return Response({'course': 'Kurs nie istnieje.'}, status=status.HTTP_400_BAD_REQUEST)
    if course.is_full:
        return Response({'course': 'Brak wolnych miejsc na wybranym kursie.'}, status=status.HTTP_400_BAD_REQUEST)

    fields = ['first_name', 'last_name', 'pesel', 'birth_date', 'email',
              'phone', 'zip_code', 'city', 'street', 'house_number', 'apartment_number', 'photo_consent']

    # Jeśli formularz przesłał dane osobowe (pełny formularz), użyj ich.
    # Jeśli nie (szybki zapis zalogowanego), skopiuj z ostatniego zapisu.
    submitted_name = request.data.get('first_name', '').strip()
    if submitted_name:
        data = {f: request.data.get(f, '') for f in fields}
        data['email'] = data.get('email') or request.user.email
        data['apartment_number'] = data.get('apartment_number') or ''
        data['photo_consent'] = bool(request.data.get('photo_consent', False))
        required = ['first_name', 'last_name', 'pesel', 'birth_date',
                    'phone', 'zip_code', 'city', 'street', 'house_number']
        missing = {f: 'To pole jest wymagane.' for f in required if not data.get(f)}
        if missing:
            return Response(missing, status=status.HTTP_400_BAD_REQUEST)
    else:
        previous = (
            Enrollment.objects
            .filter(user=request.user, is_deleted=False, pesel__gt='')
            .order_by('-created_at')
            .first()
        )
        if not previous:
            return Response(
                {'error': 'Brak danych profilu. Wypełnij formularz zapisu.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = {f: getattr(previous, f) for f in fields}

    enrollment = Enrollment.objects.create(user=request.user, course=course, **data)
    return Response({'id': enrollment.id}, status=status.HTTP_201_CREATED)


class MyEnrollmentsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = MyEnrollmentSerializer

    def get_queryset(self):
        return (
            Enrollment.objects
            .filter(user=self.request.user, is_deleted=False)
            .select_related('course')
            .order_by('-created_at')
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_my_enrollment(request, pk):
    try:
        enrollment = Enrollment.objects.get(pk=pk, user=request.user, is_deleted=False)
    except Enrollment.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    reason = request.data.get('reason', '')
    valid_reasons = [r[0] for r in Enrollment._meta.get_field('deletion_reason').choices]
    if reason not in valid_reasons:
        return Response({'reason': 'Wybierz powód rezygnacji.'}, status=status.HTTP_400_BAD_REQUEST)
    enrollment.is_deleted = True
    enrollment.deleted_at = timezone.now()
    enrollment.deletion_reason = reason
    enrollment.save()
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def restore_enrollment(request, pk):
    try:
        enrollment = Enrollment.objects.get(pk=pk, is_deleted=True)
    except Enrollment.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    enrollment.is_deleted = False
    enrollment.deleted_at = None
    enrollment.deletion_reason = ''
    enrollment.save()
    return Response(EnrollmentSerializer(enrollment).data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def send_email_to_enrollments(request):
    enrollment_ids = request.data.get('enrollment_ids', [])
    subject = request.data.get('subject', '').strip()
    body    = request.data.get('body', '').strip()

    if not subject:
        return Response({'detail': 'Podaj temat wiadomości.'}, status=status.HTTP_400_BAD_REQUEST)
    if not body:
        return Response({'detail': 'Podaj treść wiadomości.'}, status=status.HTTP_400_BAD_REQUEST)
    if not enrollment_ids:
        return Response({'detail': 'Nie wybrano żadnych uczestników.'}, status=status.HTTP_400_BAD_REQUEST)

    enrollments = Enrollment.objects.select_related('course').filter(
        id__in=enrollment_ids,
    ).exclude(email='')

    sent = 0
    failed = []
    for e in enrollments:
        course = e.course
        course_info = {
            'Kurs':     course.name,
            'Miasto':   course.city,
            'Termin':   f'{course.start_date.strftime("%d.%m.%Y") if course.start_date else "–"}'
                        f' – {course.end_date.strftime("%d.%m.%Y") if course.end_date else "–"}',
            'Egzamin':  course.exam_date.strftime('%d.%m.%Y') if course.exam_date else '–',
        }
        try:
            send_course_email(
                to_email=e.email,
                first_name=e.first_name,
                subject=subject,
                body=body,
                course_info=course_info,
            )
            sent += 1
        except Exception:
            failed.append(e.id)

    return Response({'sent': sent, 'failed': failed})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def send_sms_to_enrollments(request):
    enrollment_ids = request.data.get('enrollment_ids', [])
    message = request.data.get('message', '').strip()

    if not message:
        return Response({'detail': 'Podaj treść SMS.'}, status=status.HTTP_400_BAD_REQUEST)
    if not enrollment_ids:
        return Response({'detail': 'Nie wybrano żadnych uczestników.'}, status=status.HTTP_400_BAD_REQUEST)

    from .sms import send_sms

    enrollments = Enrollment.objects.filter(
        id__in=enrollment_ids,
    ).exclude(phone='')

    sent = 0
    failed = []
    for enrollment in enrollments:
        ok, err = send_sms(enrollment.phone, message)
        if ok:
            sent += 1
        else:
            failed.append({'id': enrollment.id, 'name': f'{enrollment.first_name} {enrollment.last_name}', 'error': err})

    return Response({'sent': sent, 'failed': failed})
