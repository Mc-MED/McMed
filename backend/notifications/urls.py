from django.urls import path
from . import views

urlpatterns = [
    path('recert-reminders/', views.recert_reminders, name='recert-reminders'),
    path('recert-reminders/tests/', views.create_test_reminder, name='recert-test-create'),
    path('recert-reminders/tests/<int:pk>/send/', views.send_test_reminder_now, name='recert-test-send'),
    path('recert-reminders/tests/<int:pk>/', views.delete_test_reminder, name='recert-test-delete'),
]
