from django.urls import path
from .views import ActivateAccountView, ResendActivationView

urlpatterns = [
    path('activate/<uuid:token>/', ActivateAccountView.as_view(), name='activate-account'),
    path('resend-activation/',     ResendActivationView.as_view(), name='resend-activation'),
]
