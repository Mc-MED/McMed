from django.db import migrations
from django.conf import settings


def encrypt_existing_pesels(apps, schema_editor):
    from cryptography.fernet import Fernet
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        raise ValueError(
            'Brak FIELD_ENCRYPTION_KEY w ustawieniach. '
            'Wygeneruj klucz: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    f = Fernet(key.encode() if isinstance(key, str) else key)
    Enrollment = apps.get_model('courses', 'Enrollment')
    to_update = []
    for enrollment in Enrollment.objects.exclude(pesel=''):
        if enrollment.pesel.isdigit():
            enrollment.pesel = f.encrypt(enrollment.pesel.encode()).decode()
            to_update.append(enrollment)
    if to_update:
        Enrollment.objects.bulk_update(to_update, ['pesel'])


def decrypt_existing_pesels(apps, schema_editor):
    from cryptography.fernet import Fernet
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        return
    f = Fernet(key.encode() if isinstance(key, str) else key)
    Enrollment = apps.get_model('courses', 'Enrollment')
    to_update = []
    for enrollment in Enrollment.objects.exclude(pesel=''):
        if not enrollment.pesel.isdigit():
            try:
                enrollment.pesel = f.decrypt(enrollment.pesel.encode()).decode()
                to_update.append(enrollment)
            except Exception:
                pass
    if to_update:
        Enrollment.objects.bulk_update(to_update, ['pesel'])


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0017_encrypt_pesel_schema'),
    ]

    operations = [
        migrations.RunPython(encrypt_existing_pesels, reverse_code=decrypt_existing_pesels),
    ]
