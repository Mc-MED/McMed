from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Course, Enrollment
from .serializers import CourseSerializer, AdminCourseSerializer, EnrollmentSerializer
from users.emails import send_activation_email

User = get_user_model()


class PublicCourseListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class   = CourseSerializer
    queryset           = Course.objects.filter(is_active=True)


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
                msg = 'Konto z tym adresem e-mail już istnieje. Możesz się zalogować.'
            else:
                msg = 'Konto z tym adresem e-mail już istnieje, ale nie zostało jeszcze aktywowane. Sprawdź skrzynkę mailową lub użyj opcji ponownego wysłania linku aktywacyjnego.'
            return Response({'email': msg}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.create_user(
                username=email.lower(),
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_active=False,
            )
            enrollment = serializer.save(user=user)

            from users.models import ActivationToken
            activation = ActivationToken.objects.create(user=user)

        self._send_enrollment_email(enrollment, activation.token)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def _send_enrollment_email(self, enrollment, token):
        if not enrollment.email:
            return

        course = enrollment.course
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        activation_link = f'{frontend_url}/aktywuj/{token}'

        def fmt(d):
            return d.strftime('%d.%m.%Y') if d else '–'

        course_info = {
            'Kurs':    course.name,
            'Termin':  f'{fmt(course.start_date)} – {fmt(course.end_date)}',
            'Miejsce': course.city,
            'Cena':    f'{course.price} zł',
        }

        send_activation_email(
            to_email=enrollment.email,
            first_name=enrollment.first_name,
            activation_link=activation_link,
            course_info=course_info,
        )


class AdminCourseListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = AdminCourseSerializer
    queryset           = Course.objects.all()


class AdminCourseCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = AdminCourseSerializer


class AdminCourseDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = AdminCourseSerializer
    queryset           = Course.objects.all()
    http_method_names  = ['get', 'patch']


class AdminEnrollmentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = EnrollmentSerializer

    def get_queryset(self):
        qs = Enrollment.objects.select_related('course')
        course_id = self.request.query_params.get('course')
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs


class AdminEnrollmentDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset           = Enrollment.objects.all()
