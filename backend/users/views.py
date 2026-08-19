from django.contrib.auth import get_user_model
from django.conf import settings

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import ActivationToken, PasswordResetToken
from .emails import send_activation_email, send_password_reset_email


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

        if not activation.is_valid:
            return Response(
                {'error': 'Link aktywacyjny wygasł lub został już użyty.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = activation.user
        user.is_active = True
        user.save(update_fields=['is_active'])

        activation.is_used = True
        activation.save(update_fields=['is_used'])

        return Response({'message': 'Konto zostało aktywowane. Możesz się teraz zalogować.'})


class ResendActivationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'Podaj adres email.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=False).order_by('-date_joined').first()
        if not user:
            # Nie ujawniamy czy email istnieje
            return Response({'message': 'Jeśli konto istnieje, link został wysłany.'})


        ActivationToken.objects.filter(user=user, is_used=False).update(is_used=True)
        token = ActivationToken.objects.create(user=user)

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        activation_link = f'{frontend_url}/aktywuj/{token.token}'

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

        return Response({'message': 'Link aktywacyjny został wysłany ponownie.'})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'Podaj adres email.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)
            token = PasswordResetToken.objects.create(user=user)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            reset_link = f'{frontend_url}/reset-hasla/{token.token}'
            send_password_reset_email(
                to_email=email,
                first_name=user.first_name or email,
                reset_link=reset_link,
            )

        return Response({'message': 'Jeśli konto istnieje, link do resetowania hasła został wysłany.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

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
