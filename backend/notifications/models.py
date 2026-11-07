from django.db import models


class TestReminder(models.Model):
    """Testowe przypomnienie o recertyfikacji z panelu admina: cron wysyła je w dniu `send_on`
    tą samą drogą co prawdziwe (mail + SMS)."""
    email   = models.EmailField(blank=True, default='')
    phone   = models.CharField(max_length=20, blank=True, default='')
    send_on = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    recert_email_sent_at  = models.DateTimeField(null=True, blank=True)
    recert_sms_sent_at    = models.DateTimeField(null=True, blank=True)
    recert_reminder_error = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
