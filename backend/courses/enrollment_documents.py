"""Skan certyfikatu KPP i podpisane oświadczenie dołączane do zapisu na recertyfikację.

Pliki leżą w PRIVATE_MEDIA_ROOT i są wydawane tylko przez API: uczestnikowi (własne), adminowi (wszystkie).
"""
import mimetypes
import os

from django.db import IntegrityError, transaction
from django.http import FileResponse, HttpResponse
from rest_framework import status
from rest_framework.response import Response

from .models import Course, EnrollmentDocument

MAX_SIZE = 10 * 1024 * 1024
# Rozszerzenie → początek pliku (sprawdzamy zawartość, nie tylko nazwę)
ALLOWED = {
    '.pdf':  (b'%PDF',),
    '.jpg':  (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
    '.png':  (b'\x89PNG',),
}
KINDS = dict(EnrollmentDocument.KINDS)
FILE_LABELS = {
    EnrollmentDocument.KIND_CERTIFICATE: 'certyfikat',
    EnrollmentDocument.KIND_STATEMENT:   'oswiadczenie',
}


def is_recert(enrollment):
    return bool(enrollment.course_id) and enrollment.course.course_type == Course.TYPE_RECERT


def document_dict(doc):
    return {
        'kind':          doc.kind,
        'original_name': doc.original_name,
        'size':          doc.size,
        'uploaded_at':   doc.uploaded_at,
        'uploaded_by_admin': doc.uploaded_by_admin,
    }


def documents_dict(enrollment):
    """{'certificate': {...} | None, 'statement': {...} | None}"""
    by_kind = {d.kind: d for d in enrollment.documents.all()}
    return {kind: (document_dict(by_kind[kind]) if kind in by_kind else None) for kind in KINDS}


def validate_upload(kind, upload):
    """Zwraca komunikat błędu albo None."""
    if kind not in KINDS:
        return 'Nieznany rodzaj dokumentu.'
    if upload is None:
        return 'Wybierz plik.'
    if upload.size > MAX_SIZE:
        return 'Plik jest za duży (maks. 10 MB).'
    ext = os.path.splitext(upload.name)[1].lower()
    if ext not in ALLOWED:
        return 'Dozwolone pliki: PDF, JPG, PNG.'
    head = upload.read(8)
    upload.seek(0)
    if not head.startswith(ALLOWED[ext]):
        return 'Plik jest uszkodzony albo ma złe rozszerzenie. Dozwolone: PDF, JPG, PNG.'
    return None


def save_upload(enrollment, kind, upload, by_admin=False):
    """Zapisuje plik; poprzedni plik tego rodzaju jest usuwany. Zwraca (doc, None) albo (None, błąd)."""
    if not is_recert(enrollment):
        return None, 'Dokumenty dołącza się tylko do zapisu na recertyfikację.'
    error = validate_upload(kind, upload)
    if error:
        return None, error
    doc = EnrollmentDocument.objects.filter(enrollment=enrollment, kind=kind).first()
    old_file = doc.file.name if doc else None
    if doc is None:
        doc = EnrollmentDocument(enrollment=enrollment, kind=kind)
    doc.original_name = os.path.basename(upload.name)[:255]
    doc.size = upload.size
    doc.uploaded_by_admin = by_admin
    doc.file.save(upload.name, upload, save=False)
    try:
        with transaction.atomic():
            doc.save()
    except IntegrityError:
        # Równoległa wysyłka tego samego dokumentu — nie zostawiamy pliku bez rekordu
        doc.file.storage.delete(doc.file.name)
        return None, 'Plik jest właśnie wysyłany. Odśwież stronę i spróbuj ponownie.'
    if old_file:
        doc.file.storage.delete(old_file)
    return doc, None


def upload_response(enrollment, request, by_admin=False):
    doc, error = save_upload(enrollment, request.data.get('kind'), request.FILES.get('file'), by_admin=by_admin)
    if error:
        return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
    return Response(documents_dict(enrollment), status=status.HTTP_201_CREATED)


def delete_response(enrollment, kind):
    doc = EnrollmentDocument.objects.filter(enrollment=enrollment, kind=kind).first()
    if doc is None:
        return Response(status=status.HTTP_404_NOT_FOUND)
    doc.delete()
    return Response(documents_dict(enrollment))


def file_response(enrollment, kind):
    doc = EnrollmentDocument.objects.filter(enrollment=enrollment, kind=kind).first()
    if doc is None:
        return Response({'detail': 'Brak pliku.'}, status=status.HTTP_404_NOT_FOUND)
    try:
        f = doc.file.open('rb')
    except (FileNotFoundError, OSError):
        return Response({'detail': 'Plik nie istnieje na serwerze.'}, status=status.HTTP_404_NOT_FOUND)
    ext = os.path.splitext(doc.file.name)[1]
    mime = mimetypes.guess_type(doc.file.name)[0] or 'application/octet-stream'
    name = f'{FILE_LABELS[kind]}_{enrollment.last_name}_{enrollment.first_name}{ext}'.replace(' ', '_')
    # filename= z FileResponse koduje polskie znaki i cudzysłowy (filename*)
    return FileResponse(f, content_type=mime, filename=name)


def statement_response(enrollment):
    """Oświadczenie do podpisu z danymi uczestnika (PDF; bez LibreOffice — DOCX)."""
    from io import BytesIO
    from docxtpl import DocxTemplate
    from documents.views import TEMPLATES_DIR, _build_certificate_context, _render_pdf

    tpl_path = TEMPLATES_DIR / 'oswiadczenie-recert.docx'
    ctx = _build_certificate_context(enrollment)
    pdf = _render_pdf(tpl_path, ctx, cache=False)   # dane osobowe (PESEL) nie zostają na dysku
    if pdf is not None:
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="oswiadczenie.pdf"'
        return response
    tpl = DocxTemplate(tpl_path)
    tpl.render(ctx)
    buf = BytesIO()
    tpl.save(buf)
    response = HttpResponse(
        buf.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    response['Content-Disposition'] = 'attachment; filename="oswiadczenie.docx"'
    return response
