"""Publiczna strona płatności (/platnosc/<token>) i powiadomienia Przelewy24."""
import logging
import uuid

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import przelewy24
from .billing import mark_paid_and_invoice
from .models import Enrollment, Invoice, Payment

logger = logging.getLogger(__name__)


def _enrollment(token):
    return get_object_or_404(
        Enrollment.objects.select_related('course'), payment_token=token, is_deleted=False, course__isnull=False,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def payment_info(request, token):
    enrollment = _enrollment(token)
    proforma = enrollment.invoices.filter(kind=Invoice.KIND_PROFORMA).exclude(fakturownia_id='').first()
    invoice  = enrollment.invoices.filter(kind=Invoice.KIND_VAT).exclude(fakturownia_id='').first()
    last_online = enrollment.payments.filter(method=Payment.METHOD_ONLINE).order_by('created_at').last()
    return Response({
        'first_name':      enrollment.first_name,
        'last_name':       enrollment.last_name,
        'course_name':     enrollment.course.name,
        'course_type':     enrollment.course.course_type,
        'amount':          str(enrollment.course.price),
        'proforma_number': proforma.number if proforma else '',
        'invoice_number':  invoice.number if invoice else '',
        'paid':            enrollment.payment_status == 'paid',
        'pending':         enrollment.payments.filter(status=Payment.STATUS_PENDING, method=Payment.METHOD_ONLINE).exists(),
        'test_payment':    bool(last_online and last_online.status == Payment.STATUS_TEST),
        'sandbox':         przelewy24.mode() == 'sandbox',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def payment_start(request, token):
    enrollment = _enrollment(token)
    if enrollment.payment_status == 'paid':
        return Response({'detail': 'Kurs jest już opłacony.'}, status=status.HTTP_400_BAD_REQUEST)
    if enrollment.course.price <= 0:
        return Response({'detail': 'Ten kurs nie ma ustalonej ceny.'}, status=status.HTTP_400_BAD_REQUEST)

    payment = Payment.objects.create(
        enrollment=enrollment,
        session_id=uuid.uuid4().hex,
        amount=int(enrollment.course.price * 100),
        method=Payment.METHOD_ONLINE,
    )
    return_url = f'{settings.FRONTEND_URL}/platnosc/{token}/status'

    if przelewy24.mode() == 'fake':
        return Response({'redirect_url': f'{settings.FRONTEND_URL}/platnosc/{token}/symulacja?session={payment.session_id}'})

    ok, result = przelewy24.register(
        payment,
        description=f'{enrollment.first_name} {enrollment.last_name} – {enrollment.course.name}',
        email=enrollment.email,
        url_return=return_url,
        url_status=f'{settings.BACKEND_URL}/api/payments/p24/notify/',
    )
    if not ok:
        logger.error('Rejestracja płatności %s: %s', payment.session_id, result)
        payment.status = Payment.STATUS_FAILED
        payment.save(update_fields=['status'])
        return Response({'detail': 'Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.'},
                        status=status.HTTP_502_BAD_GATEWAY)
    return Response({'redirect_url': result})


@api_view(['POST'])
@permission_classes([AllowAny])
def payment_fake_confirm(request, token):
    """Symulacja wyniku płatności — tylko lokalnie (DEBUG i P24_MODE=fake)."""
    if not settings.DEBUG or przelewy24.mode() != 'fake':
        return Response(status=status.HTTP_404_NOT_FOUND)
    enrollment = _enrollment(token)
    payment = get_object_or_404(Payment, enrollment=enrollment, session_id=request.data.get('session', ''))
    if not request.data.get('success'):
        payment.status = Payment.STATUS_FAILED
        payment.save(update_fields=['status'])
        return Response({'ok': True})
    mark_paid_and_invoice(enrollment, Payment.METHOD_ONLINE, payment)
    return Response({'ok': True})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def p24_notify(request):
    """urlStatus: Przelewy24 informuje o wpłacie → weryfikacja w P24 → faktura VAT."""
    data = request.data
    if not przelewy24.notification_valid(data):
        logger.warning('Przelewy24: niepoprawny podpis powiadomienia %s', data.get('sessionId'))
        return Response(status=status.HTTP_400_BAD_REQUEST)
    try:
        payment = Payment.objects.select_related('enrollment__course').get(session_id=data['sessionId'])
    except Payment.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    if int(data['amount']) != payment.amount:
        logger.error('Przelewy24: kwota %s ≠ %s dla %s', data['amount'], payment.amount, payment.session_id)
        return Response(status=status.HTTP_400_BAD_REQUEST)
    if payment.status == Payment.STATUS_PAID:
        return Response({'ok': True})

    ok, msg = przelewy24.verify(payment, data['orderId'])
    if not ok:
        logger.error('Przelewy24: weryfikacja %s nieudana: %s', payment.session_id, msg)
        return Response(status=status.HTTP_502_BAD_GATEWAY)
    payment.p24_order_id = str(data['orderId'])
    if przelewy24.mode() == 'sandbox':
        # Sandbox na żywej stronie (np. na czas weryfikacji konta P24): pieniądze nie wpłynęły,
        # więc zapis zostaje nieopłacony i nie powstaje faktura VAT.
        logger.warning('Przelewy24 sandbox: płatność testowa %s — bez faktury', payment.session_id)
        payment.status = Payment.STATUS_TEST
        payment.save(update_fields=['p24_order_id', 'status'])
        return Response({'ok': True})
    payment.save(update_fields=['p24_order_id'])
    mark_paid_and_invoice(payment.enrollment, Payment.METHOD_ONLINE, payment)
    return Response({'ok': True})
