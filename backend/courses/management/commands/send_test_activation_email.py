from django.core.management.base import BaseCommand
from django.conf import settings
from users.emails import send_activation_email


class Command(BaseCommand):
    help = 'Wysyła testowy mail aktywacyjny z blokiem zaliczki'

    def add_arguments(self, parser):
        parser.add_argument('email', nargs='?', default=settings.EMAIL_HOST_USER)

    def handle(self, *args, **options):
        recipient = options['email']
        send_activation_email(
            to_email=recipient,
            first_name='Jan',
            activation_link='http://localhost:3000/aktywuj/TESTOWY-TOKEN-ABC123',
            course_info={
                'Kurs':    'Kurs Kwalifikowanej Pierwszej Pomocy',
                'Termin':  '15.03.2025 – 16.03.2025',
                'Miejsce': 'Ełk',
                'Cena':    '600 zł',
            },
            payment_title='Jan Kowalski Kurs Kwalifikowanej Pierwszej Pomocy - zaliczka, Marzec - Ełk 2025',
        )
        self.stdout.write(self.style.SUCCESS(f'Mail wysłany na: {recipient}'))
