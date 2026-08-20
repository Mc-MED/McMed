from django.db import migrations
from django.conf import settings


def fix_double_encrypted_pesels(apps, schema_editor):
    from cryptography.fernet import Fernet, InvalidToken
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        return
    f = Fernet(key.encode() if isinstance(key, str) else key)

    updates = []
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT id, pesel FROM courses_enrollment WHERE pesel != ''")
        for enrollment_id, raw_pesel in cursor.fetchall():
            if not raw_pesel or raw_pesel.isdigit():
                continue
            try:
                inner = f.decrypt(raw_pesel.encode()).decode()
                if not inner.isdigit():
                    # Podwójnie zaszyfrowany: odszyfruj warstwę zewnętrzną i wewnętrzną,
                    # następnie zaszyfruj raz poprawnie
                    plaintext = f.decrypt(inner.encode()).decode()
                    updates.append((f.encrypt(plaintext.encode()).decode(), enrollment_id))
            except (InvalidToken, Exception):
                pass

    with schema_editor.connection.cursor() as cursor:
        for correct_pesel, enrollment_id in updates:
            cursor.execute(
                "UPDATE courses_enrollment SET pesel = %s WHERE id = %s",
                [correct_pesel, enrollment_id],
            )


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0018_encrypt_pesel_data'),
    ]

    operations = [
        migrations.RunPython(fix_double_encrypted_pesels, migrations.RunPython.noop),
    ]
