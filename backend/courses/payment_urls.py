from django.urls import path
from . import payment_views

urlpatterns = [
    path('p24/notify/', payment_views.p24_notify, name='payment-p24-notify'),
    path('<uuid:token>/', payment_views.payment_info, name='payment-info'),
    path('<uuid:token>/start/', payment_views.payment_start, name='payment-start'),
    path('<uuid:token>/fake-confirm/', payment_views.payment_fake_confirm, name='payment-fake-confirm'),
]
