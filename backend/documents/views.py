import re
from io import BytesIO
from pathlib import Path

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from docxtpl import DocxTemplate
import openpyxl

from courses.models import Course, Instructor

TEMPLATES_DIR = Path(__file__).parent / 'templates'

ALLOWED_TEMPLATES = {'file1', 'file2', 'file3', 'file4', 'file5', 'file6'}

ALLOWED_XLSX_TEMPLATES = {'program'}


def _instructor_dict(inst):
    name_only = f'{inst.first_name} {inst.last_name}'.strip()
    return {
        'full_name':   str(inst),
        'name_only':   name_only,
        'title':       inst.title or '',
        'profession':  inst.profession or '',
        'specs':       inst.specializations_str,
        'years':       inst.years_experience or '',
    }


_EMPTY_INST = {'full_name': '', 'name_only': '', 'title': '', 'profession': '', 'specs': '', 'years': ''}


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

    order = course.instructor_order or []
    if order:
        inst_map = {i.pk: i for i in Instructor.objects.filter(pk__in=order)}
        instructors_list = [_instructor_dict(inst_map[pk]) for pk in order if pk in inst_map]
    else:
        instructors_list = [_instructor_dict(i) for i in course.instructors.all()]

    # Płaskie zmienne instructor_N / instructor_N_name / _title / _profession dla slotów 1–6
    flat_instructors = {}
    for n in range(1, 7):
        d = instructors_list[n - 1] if n <= len(instructors_list) else _EMPTY_INST
        flat_instructors[f'instructor_{n}']            = d['full_name']
        flat_instructors[f'instructor_{n}_name']       = d['name_only']
        flat_instructors[f'instructor_{n}_title']      = d['title']
        flat_instructors[f'instructor_{n}_profession'] = d['profession']
        flat_instructors[f'instructor_{n}_specs']      = d['specs']
        flat_instructors[f'instructor_{n}_years']      = d['years']

    def fmt_range(start, end):
        if not start and not end:
            return ''
        if not start:
            return fmt(end)
        if not end:
            return fmt(start)
        if start.month == end.month and start.year == end.year:
            return f'{start.day} – {end.strftime("%d.%m.%Y")}'
        if start.year == end.year:
            return f'{start.strftime("%d.%m")} – {end.strftime("%d.%m.%Y")}'
        return f'{fmt(start)} – {fmt(end)}'

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
        'date_range':        fmt_range(course.start_date, course.end_date),
        'exam_date':         fmt(course.exam_date),
        'exam_time':         course.exam_time.strftime('%H:%M') if course.exam_time else '',
        'exam_location':     course.exam_location or '',
        'course_days':       [fmt_str(d) for d in (course.course_days or [])],
        'entity_director':   course.entity_director or '',
        'academic_director': course.academic_director or '',
        # Lista słowników – w docx: {{instructors.0.full_name}}, pętla {% for i in instructors %}
        'instructors':       instructors_list,
        'psychologist':      course.psychologist or '',
        'committee_chair':   course.committee_chair or '',
        'committee_member1': course.committee_member1 or '',
        'committee_member2': course.committee_member2 or '',
        **flat_instructors,
    }


def _xlsx_replace(ws, context):
    """Podmienia {{klucz}} i {{course_days.N}} / {{instructors.N.pole}} w każdej komórce."""
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
                    # {{instructors.N}} → full_name; {{instructors.N.pole}} → pole
                    for i, inst in enumerate(replacement):
                        val = val.replace(f'{{{{{key}.{i}}}}}', inst.get('full_name', ''))
                        for field in ('full_name', 'name_only', 'title', 'profession'):
                            val = val.replace(f'{{{{{key}.{i}.{field}}}}}', inst.get(field, ''))
                elif not isinstance(replacement, (list, dict)):
                    val = re.sub(r'\{\{\s*' + re.escape(key) + r'\s*\}\}', str(replacement), val)
            cell.value = val


def _resolve_xlsx(doc_name, instructor_count):
    """Zwraca ścieżkę do pliku: szuka {name}.{n}.xlsx, fallback do {name}.xlsx."""
    variant = TEMPLATES_DIR / f'{doc_name}.{instructor_count}.xlsx'
    if variant.exists():
        return variant
    base = TEMPLATES_DIR / f'{doc_name}.xlsx'
    if base.exists():
        return base
    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_xlsx(request, course_id, doc_name):
    if doc_name not in ALLOWED_XLSX_TEMPLATES:
        return Response({'detail': 'Nieznany dokument.'}, status=404)

    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Kurs nie istnieje.'}, status=404)

    instructor_count = len(course.instructor_order) if course.instructor_order else course.instructors.count()
    tpl_path = _resolve_xlsx(doc_name, instructor_count)
    if tpl_path is None:
        return Response({'detail': 'Brak pliku szablonu.'}, status=404)

    wb = openpyxl.load_workbook(tpl_path)
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


def _resolve_template(doc_name, instructor_count):
    """Zwraca ścieżkę do pliku: szuka {name}.{n}.docx, fallback do {name}.docx."""
    variant = TEMPLATES_DIR / f'{doc_name}.{instructor_count}.docx'
    if variant.exists():
        return variant
    base = TEMPLATES_DIR / f'{doc_name}.docx'
    if base.exists():
        return base
    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_document(request, course_id, doc_name):
    if doc_name not in ALLOWED_TEMPLATES:
        return Response({'detail': 'Nieznany dokument.'}, status=404)

    try:
        course = Course.objects.get(pk=course_id)
    except Course.DoesNotExist:
        return Response({'detail': 'Kurs nie istnieje.'}, status=404)

    instructor_count = len(course.instructor_order) if course.instructor_order else course.instructors.count()
    tpl_path = _resolve_template(doc_name, instructor_count)
    if tpl_path is None:
        return Response({'detail': 'Brak pliku szablonu.'}, status=404)

    tpl = DocxTemplate(tpl_path)
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
