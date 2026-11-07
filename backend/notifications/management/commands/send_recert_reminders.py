from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.reminders import send_due_reminders


class Command(BaseCommand):
    help = ('Wysyła mail i SMS uczestnikom, którym za 3 miesiące wygasa certyfikat KPP, '
            'oraz zaplanowane przypomnienia testowe. Uruchamiane raz dziennie z crona.')

    def handle(self, *args, **options):
        handled, failed = send_due_reminders()
        self.stdout.write(
            f'{timezone.localtime():%Y-%m-%d %H:%M} Przypomnienia o recertyfikacji: '
            f'{handled} wysyłek, {failed} z błędem'
        )
