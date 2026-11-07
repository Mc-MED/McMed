from datetime import date

from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from courses.models import Enrollment
from courses.sms import _normalize_phone
from .models import TestReminder
from .reminders import cert_expiry, reminder_date, reminder_status, send_test_reminder


def _test_dict(t):
    return {
        'id': t.id, 'email': t.email, 'phone': t.phone, 'send_on': t.send_on,
        'created_at': t.created_at,
        'email_sent_at': t.recert_email_sent_at, 'sms_sent_at': t.recert_sms_sent_at,
        'error': t.recert_reminder_error,
    }


@api_view(['GET'])
@permission_classes([IsAdminUser])
def recert_reminders(request):
    today = timezone.localdate()
    enrollments = (
        Enrollment.objects.filter(is_deleted=False, cert_date__isnull=False)
        .select_related('course').order_by('cert_date', 'last_name')
    )
    rows = [{
        'id': e.id,
        'first_name': e.first_name,
        'last_name': e.last_name,
        'course_name': e.course.name if e.course else '',
        'email': e.email,
        'phone': e.phone,
        'cert_number': e.cert_number,
        'cert_date': e.cert_date,
        'reminder_date': reminder_date(e.cert_date),
        'expiry_date': cert_expiry(e.cert_date),
        'status': reminder_status(e, today),
        'email_sent_at': e.recert_email_sent_at,
        'sms_sent_at': e.recert_sms_sent_at,
        'error': e.recert_reminder_error,
    } for e in enrollments]
    return Response({
        'today': today,
        'rows': rows,
        'tests': [_test_dict(t) for t in TestReminder.objects.all()[:20]],
    })


@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_test_reminder(request):
    email = (request.data.get('email') or '').strip()
    phone = (request.data.get('phone') or '').strip()
    errors = {}
    if not email and not phone:
        errors['detail'] = 'Podaj adres e-mail lub numer telefonu.'
    if email:
        try:
            validate_email(email)
        except ValidationError:
            errors['email'] = 'Niepoprawny adres e-mail.'
    if phone and not _normalize_phone(phone):
        errors['phone'] = 'Niepoprawny numer telefonu.'
    try:
        send_on = date.fromisoformat(request.data.get('send_on') or '')
    except ValueError:
        errors['send_on'] = 'Podaj datę wysyłki.'
    else:
        if send_on < timezone.localdate():
            errors['send_on'] = 'Data wysyłki nie może być z przeszłości.'
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    test = TestReminder.objects.create(email=email, phone=phone, send_on=send_on)
    return Response(_test_dict(test), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def send_test_reminder_now(request, pk):
    try:
        test = TestReminder.objects.get(pk=pk)
    except TestReminder.DoesNotExist:
        return Response({'detail': 'Nie ma takiego testu.'}, status=status.HTTP_404_NOT_FOUND)
    # „Wyślij teraz” ponawia oba kanały, także już wysłane
    test.recert_email_sent_at = test.recert_sms_sent_at = None
    test.save(update_fields=['recert_email_sent_at', 'recert_sms_sent_at'])
    send_test_reminder(test)
    return Response(_test_dict(test))


@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def delete_test_reminder(request, pk):
    TestReminder.objects.filter(pk=pk).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
