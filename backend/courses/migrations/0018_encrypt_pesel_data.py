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

    updates = []
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT id, pesel FROM courses_enrollment WHERE pesel != ''")
        for enrollment_id, raw_pesel in cursor.fetchall():
            if raw_pesel and raw_pesel.isdigit():
                updates.append((f.encrypt(raw_pesel.encode()).decode(), enrollment_id))

    with schema_editor.connection.cursor() as cursor:
        for encrypted_pesel, enrollment_id in updates:
            cursor.execute(
                "UPDATE courses_enrollment SET pesel = %s WHERE id = %s",
                [encrypted_pesel, enrollment_id],
            )


def decrypt_existing_pesels(apps, schema_editor):
    from cryptography.fernet import Fernet, InvalidToken
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        return
    f = Fernet(key.encode() if isinstance(key, str) else key)

    updates = []
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT id, pesel FROM courses_enrollment WHERE pesel != ''")
        for enrollment_id, raw_pesel in cursor.fetchall():
            if raw_pesel and not raw_pesel.isdigit():
                try:
                    updates.append((f.decrypt(raw_pesel.encode()).decode(), enrollment_id))
                except (InvalidToken, Exception):
                    pass

    with schema_editor.connection.cursor() as cursor:
        for plaintext_pesel, enrollment_id in updates:
            cursor.execute(
                "UPDATE courses_enrollment SET pesel = %s WHERE id = %s",
                [plaintext_pesel, enrollment_id],
            )


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0017_encrypt_pesel_schema'),
    ]

    operations = [
        migrations.RunPython(encrypt_existing_pesels, reverse_code=decrypt_existing_pesels),
    ]
