from django.db import models


class Presentation(models.Model):
    file = models.FileField(upload_to='presentations/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    @classmethod
    def get_current(cls):
        return cls.objects.first()
