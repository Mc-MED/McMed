from django.urls import path
from .views import ActivateAccountView, ResendActivationView, PasswordResetRequestView, PasswordResetConfirmView

urlpatterns = [
    path('activate/<uuid:token>/',        ActivateAccountView.as_view(),      name='activate-account'),
    path('resend-activation/',            ResendActivationView.as_view(),      name='resend-activation'),
    path('password-reset/',               PasswordResetRequestView.as_view(),  name='password-reset-request'),
    path('password-reset/<uuid:token>/',  PasswordResetConfirmView.as_view(),  name='password-reset-confirm'),
]
