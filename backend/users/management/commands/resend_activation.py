from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from users.models import ActivationToken

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

        self.stdout.write(self.style.SUCCESS(
            f'Link aktywacyjny wysłany na {email}\n'
            f'Token ważny do: {token.expires_at.strftime("%d.%m.%Y %H:%M")}'
        ))
