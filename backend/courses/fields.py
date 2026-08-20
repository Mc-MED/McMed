from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken


def _fernet():
    key = settings.FIELD_ENCRYPTION_KEY
    return Fernet(key.encode() if isinstance(key, str) else key)


class EncryptedCharField(models.TextField):
    """TextField przechowujący wartość zaszyfrowaną kluczem Fernet (AES-128-CBC + HMAC).

    Szyfrowanie/deszyfrowanie jest transparentne — kod aplikacji operuje na
    wartości plaintext, baza danych nigdy nie widzi czytelnej wartości.

    Puste ciągi znaków są przechowywane as-is (bez szyfrowania).
    """

    def from_db_value(self, value, expression, connection):
        if not value:
            return value
        try:
            return _fernet().decrypt(value.encode()).decode()
        except (InvalidToken, Exception):
            return value

    def get_prep_value(self, value):
        if not value:
            return value
        plaintext = value.encode() if isinstance(value, str) else value
        return _fernet().encrypt(plaintext).decode()
