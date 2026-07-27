from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from .models import ActivationToken

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

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Nie ujawniamy czy email istnieje
            return Response({'message': 'Jeśli konto istnieje, link został wysłany.'})

        if user.is_active:
            return Response({'message': 'Konto jest już aktywne. Możesz się zalogować.'})

        ActivationToken.objects.filter(user=user, is_used=False).update(is_used=True)
        token = ActivationToken.objects.create(user=user)

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        activation_link = f'{frontend_url}/aktywuj/{token.token}'

        enrollment = user.enrollments.select_related('course').order_by('-created_at').first()
        if enrollment and enrollment.course:
            course = enrollment.course
            def fmt(d):
                return d.strftime('%d.%m.%Y') if d else '–'
            course_info = (
                f'Kurs:    {course.name}\n'
                f'Termin:  {fmt(course.start_date)} – {fmt(course.end_date)}\n'
                f'Miejsce: {course.city}\n\n'
            )
            first_name = enrollment.first_name
        else:
            course_info = ''
            first_name = user.first_name or email

        body = (
            f'Dzień dobry {first_name},\n\n'
            f'Wysyłamy ponownie link aktywacyjny dla Twojego konta w systemie Mc Med.\n\n'
            f'{course_info}'
            f'─────────────────────────────────────\n'
            f'Aktywuj swoje konto\n'
            f'─────────────────────────────────────\n'
            f'Kliknij w poniższy link, aby aktywować konto:\n\n'
            f'{activation_link}\n\n'
            f'Link jest ważny przez 72 godziny.\n\n'
            f'Pozdrawiamy,\n'
            f'Zespół Mc Med'
        )

        send_mail(
            subject='Ponowna aktywacja konta – Mc Med',
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response({'message': 'Link aktywacyjny został wysłany ponownie.'})
