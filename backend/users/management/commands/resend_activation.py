from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone

from users.models import ActivationToken
from users.emails import send_activation_email

User = get_user_model()


class Command(BaseCommand):
    help = 'Sprawdza czy email istnieje w bazie i wysyła nowy link aktywacyjny.'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str)

    def handle(self, *args, **options):
        email = options['email'].strip().lower()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f'Nie znaleziono użytkownika z adresem: {email}')

        if user.is_active:
            self.stdout.write(self.style.WARNING(
                f'Konto {email} jest już aktywne. Link aktywacyjny nie jest potrzebny.'
            ))
            return

        # Unieważnij stare tokeny
        ActivationToken.objects.filter(user=user, is_used=False).update(is_used=True)

        # Utwórz nowy token
        token = ActivationToken.objects.create(user=user)

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        activation_link = f'{frontend_url}/aktywuj/{token.token}'

        # Pobierz dane zapisu (ostatni enrollment)
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

        self.stdout.write(self.style.SUCCESS(
            f'Link aktywacyjny wysłany na {email}\n'
            f'Token ważny do: {token.expires_at.strftime("%d.%m.%Y %H:%M")}'
        ))
