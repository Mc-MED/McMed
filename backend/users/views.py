from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import ActivationToken, PasswordResetToken
from .emails import send_activation_email, send_password_reset_email
from config.throttles import AuthRateThrottle, PasswordResetRateThrottle


class ParticipantTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email']      = user.email
        token['username']   = user.username
        token['first_name'] = user.first_name
        return token


class ParticipantTokenView(TokenObtainPairView):
    serializer_class = ParticipantTokenSerializer
    throttle_classes = [AuthRateThrottle]

User = get_user_model()


class ActivateAccountView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            activation = ActivationToken.objects.select_related('user').get(token=token)
        except ActivationToken.DoesNotExist:
            return Response(
                {'error': 'Nieprawidłowy link aktywacyjny.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        user = activation.user

        # Ponowne kliknięcie / skaner poczty / podwójny request – konto już aktywne
        if user.is_active:
            return Response({'message': 'Konto jest już aktywne. Możesz się zalogować.'})

        if not activation.is_valid:
            return Response(
                {'error': 'Link aktywacyjny wygasł lub został już użyty.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = True
        user.save(update_fields=['is_active'])

        activation.is_used = True
        activation.save(update_fields=['is_used'])

        return Response({'message': 'Konto zostało aktywowane. Możesz się teraz zalogować.'})


class ResendActivationView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [PasswordResetRateThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'Podaj adres email.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=False).order_by('-date_joined').first()
        if not user:
            # Nie ujawniamy czy email istnieje
            return Response({'message': 'Jeśli konto istnieje, link został wysłany.'})

        send_new_activation_email(user, email)

        return Response({'message': 'Link aktywacyjny został wysłany ponownie.'})


def _frontend_url():
    return getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')


def new_activation_link(user):
    """Unieważnia poprzednie tokeny aktywacyjne i zwraca nowy link (ważny 72 h)."""
    ActivationToken.objects.filter(user=user, is_used=False).update(is_used=True)
    token = ActivationToken.objects.create(user=user)
    return f'{_frontend_url()}/aktywuj/{token.token}'


def new_reset_link(user):
    """Unieważnia poprzednie tokeny resetu hasła i zwraca nowy link (ważny 2 h)."""
    PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)
    token = PasswordResetToken.objects.create(user=user)
    return f'{_frontend_url()}/reset-hasla/{token.token}'


def send_new_activation_email(user, email):
    activation_link = new_activation_link(user)

    enrollment = user.enrollments.select_related('course').order_by('-created_at').first()
    if enrollment and enrollment.course:
        course = enrollment.course
        def fmt(d):
            return d.strftime('%d.%m.%Y') if d else '–'
        course_info = {
            'Kurs':    course.name,
            'Termin':  f'{fmt(course.start_date)} – {fmt(course.end_date)}',
            'Miejsce': course.city,
        }
        first_name = enrollment.first_name
    else:
        course_info = None
        first_name = user.first_name or email

    send_activation_email(
        to_email=email,
        first_name=first_name,
        activation_link=activation_link,
        course_info=course_info,
        resend=True,
    )


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [PasswordResetRateThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'Podaj adres email.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            send_password_reset_email(
                to_email=email,
                first_name=user.first_name or email,
                reset_link=new_reset_link(user),
            )

        return Response({'message': 'Jeśli konto istnieje, link do resetowania hasła został wysłany.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [PasswordResetRateThrottle]

    def post(self, request, token):
        password = request.data.get('password', '')
        if len(password) < 8:
            return Response(
                {'password': 'Hasło musi mieć min. 8 znaków.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reset = PasswordResetToken.objects.select_related('user').get(token=token)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Nieprawidłowy lub wygasły link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reset.is_valid:
            return Response(
                {'error': 'Link do resetowania hasła wygasł lub został już użyty.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = reset.user
        user.set_password(password)
        user.save(update_fields=['password'])

        reset.is_used = True
        reset.save(update_fields=['is_used'])

        return Response({'message': 'Hasło zostało zmienione. Możesz się teraz zalogować.'})


class AdminGenerateResetLinkView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        user, email, error = _admin_resolve(request)
        if error:
            return error

        # Nieaktywne konto → link aktywacyjny, aktywne → link do resetu hasła
        if not user.is_active:
            return Response({'type': 'activation', 'link': new_activation_link(user)})
        return Response({'type': 'reset', 'link': new_reset_link(user)})


class AdminSendAccessEmailView(APIView):
    """Nieaktywne konto → wysyła nowy link aktywacyjny, aktywne → link do resetu hasła."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        user, email, error = _admin_resolve(request)
        if error:
            return error

        if not user.is_active:
            send_new_activation_email(user, email)
            return Response({'type': 'activation'})

        send_password_reset_email(
            to_email=email,
            first_name=user.first_name or email,
            reset_link=new_reset_link(user),
        )
        return Response({'type': 'reset'})


def _admin_find_user(email):
    # Przy duplikatach preferuj aktywne konto, potem najnowsze
    return (
        User.objects.filter(email__iexact=email)
        .order_by('-is_active', '-date_joined')
        .first()
    )


class EmailTakenError(Exception):
    pass


def sync_account_email(user, email):
    """Ustawia email i login konta na podany adres (login = email małymi literami).

    Rzuca EmailTakenError, jeśli adres należy już do innego konta.
    """
    email = (email or '').strip()
    if not email or (user.email == email and user.username == email.lower()):
        return
    taken = (
        User.objects.exclude(pk=user.pk)
        .filter(Q(email__iexact=email) | Q(username=email.lower()))
        .exists()
    )
    if taken:
        raise EmailTakenError
    user.email = email
    user.username = email.lower()
    user.save(update_fields=['email', 'username'])


EMAIL_TAKEN_MSG = 'Ten adres email jest już przypisany do innego konta.'


def _admin_resolve(request):
    """Zwraca (user, email, error_response) na podstawie enrollment_id lub email."""
    from courses.models import Enrollment

    enrollment_id = request.data.get('enrollment_id')
    if enrollment_id:
        enrollment = Enrollment.objects.select_related('user').filter(pk=enrollment_id).first()
        if not enrollment:
            return None, None, Response({'error': 'Nie znaleziono zapisu.'}, status=status.HTTP_404_NOT_FOUND)
        if not enrollment.user:
            return None, None, Response(
                {'error': 'Ten uczestnik nie ma konta w systemie.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Email w zapisie mógł zostać poprawiony przez admina – wyrównaj konto
        try:
            sync_account_email(enrollment.user, enrollment.email)
        except EmailTakenError:
            return None, None, Response({'error': EMAIL_TAKEN_MSG}, status=status.HTTP_409_CONFLICT)
        return enrollment.user, enrollment.user.email, None

    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return None, None, Response({'error': 'Podaj adres email.'}, status=status.HTTP_400_BAD_REQUEST)
    user = _admin_find_user(email)
    if not user:
        return None, None, Response(
            {'error': 'Nie znaleziono konta z tym adresem email.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return user, email, None
