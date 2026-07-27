from io import BytesIO
from pathlib import Path

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from docxtpl import DocxTemplate
import openpyxl

from courses.models import Course

TEMPLATES_DIR = Path(__file__).parent / 'templates'

ALLOWED_TEMPLATES = {
    'file1': 'file1.docx',
    'file2': 'file2.docx',
    'file3': 'file3.docx',
    'file4': 'file4.docx',
    'file5': 'file5.docx',
    'file6': 'file6.docx',
}

ALLOWED_XLSX_TEMPLATES = {
    'program': 'Program zajęć.xlsx',
}


def _build_context(course):
    enrolled_count = course.enrollments.count()

    def fmt(date):
        return date.strftime('%d.%m.%Y') if date else ''

    def fmt_str(iso):
        if not iso:
            return ''
        try:
            y, m, d = iso.split('-')
            return f'{d}.{m}.{y}'
        except Exception:
            return iso

    return {
        'created_at':        course.created_at.strftime('%d.%m.%Y'),
        'name':              course.name,
        'course_type':       course.course_type,
        'city':              course.city,
        'address':           course.city,
        'price':             course.price,
        'max_participants':  course.max_participants,
        'enrolled_count':    enrolled_count,
        'spots_left':        course.spots_left,
        'start_date':        fmt(course.start_date),
        'end_date':          fmt(course.end_date),
        'exam_date':         fmt(course.exam_date),
        'exam_time':         course.exam_time.strftime('%H:%M') if course.exam_time else '',
        'exam_location':     course.exam_location or '',
        'course_days':       [fmt_str(d) for d in (course.course_days or [])],
        'entity_director':   course.entity_director or '',
        'academic_director': course.academic_director or '',
        'instructors':       course.instructors or [],
        'psychologist':      course.psychologist or '',
        'committee_chair':   course.committee_chair or '',
        'committee_member1': course.committee_member1 or '',
        'committee_member2': course.committee_member2 or '',
    }


def _xlsx_replace(ws, context):
    """Podmienia {{klucz}} i {{course_days.N}} w każdej komórce arkusza."""
    for row in ws.iter_rows():
        for cell in row:
            if not isinstance(cell.value, str) or '{{' not in cell.value:
                continue
            val = cell.value
            for key, replacement in context.items():
                if key == 'course_days':
                    for i, day in enumerate(replacement):
                        val = val.replace(f'{{{{{key}.{i}}}}}', str(day))
                elif key == 'instructors':
                    for i, inst in enumerate(replacement):
                        val = val.replace(f'{{{{{key}.{i}}}}}', str(inst))
                else:
                    val = val.replace(f'{{{{{key}}}}}', str(replacement))
            cell.value = val


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_xlsx(request, course_id, doc_name):
    if doc_name not in ALLOWED_XLSX_TEMPLATES:
        return Response({'detail': 'Nieznany dokument.'}, status=404)

    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Kurs nie istnieje.'}, status=404)

    wb = openpyxl.load_workbook(TEMPLATES_DIR / ALLOWED_XLSX_TEMPLATES[doc_name])
    ctx = _build_context(course)
    for ws in wb.worksheets:
        _xlsx_replace(ws, ctx)

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    response = HttpResponse(
        buf.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response['Content-Disposition'] = f'attachment; filename="{doc_name}_kurs_{course_id}.xlsx"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_document(request, course_id, doc_name):
    if doc_name not in ALLOWED_TEMPLATES:
        return Response({'detail': 'Nieznany dokument.'}, status=404)

    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Kurs nie istnieje.'}, status=404)

    tpl = DocxTemplate(TEMPLATES_DIR / ALLOWED_TEMPLATES[doc_name])
    tpl.render(_build_context(course))

    buf = BytesIO()
    tpl.save(buf)
    buf.seek(0)

    response = HttpResponse(
        buf.read(),
        content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    response['Content-Disposition'] = f'attachment; filename="{doc_name}_kurs_{course_id}.docx"'
    return response
