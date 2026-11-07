from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.reminders import send_due_reminders

# Godziny wysyłki (czas polski): od 8:00 do 20:00. Poza nimi nic nie wychodzi, także przy ręcznym uruchomieniu joba.
SEND_FROM_HOUR = 8
SEND_UNTIL_HOUR = 20


class Command(BaseCommand):
    help = ('Wysyła mail i SMS uczestnikom, którym za 3 miesiące wygasa certyfikat KPP, '
            'oraz zaplanowane przypomnienia testowe. Uruchamiane raz dziennie z crona, tylko w godzinach 8–20.')

    def handle(self, *args, **options):
        now = timezone.localtime()
        if not SEND_FROM_HOUR <= now.hour < SEND_UNTIL_HOUR:
            self.stdout.write(
                f'{now:%Y-%m-%d %H:%M} Przypomnienia o recertyfikacji: poza godzinami wysyłki '
                f'({SEND_FROM_HOUR}:00–{SEND_UNTIL_HOUR}:00) — nic nie wysłano'
            )
            return
        handled, failed = send_due_reminders()
        self.stdout.write(
            f'{now:%Y-%m-%d %H:%M} Przypomnienia o recertyfikacji: {handled} wysyłek, {failed} z błędem'
        )
