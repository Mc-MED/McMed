from rest_framework.throttling import AnonRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    scope = 'auth'


class PasswordResetRateThrottle(AnonRateThrottle):
    scope = 'password_reset'
