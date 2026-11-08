"""Pieczątki prowadzących na certyfikatach.

Skan pieczątki (JPG / PNG / PDF — pierwsza strona) trafia do `Instructor.stamp` jako PNG z przezroczystym tłem (prepare_stamp). Przy generowaniu
certyfikatu pieczątki kierownika podmiotu i komisji egzaminacyjnej są wstawiane nad liniami podpisów
jako obrazy „przed tekstem”, więc nie przesuwają układu dokumentu.
"""
from io import BytesIO

from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from docx.shared import Cm
from PIL import Image, ImageChops, ImageOps

from courses.models import Instructor

MAX_UPLOAD = 10 * 1024 * 1024
MAX_SIDE = 1200          # px — wystarczy do druku pieczątki ~4 cm
WHITE_THRESHOLD = 225    # jaśniejsze piksele (papier) → przezroczyste
PDF_DPI = 300

# (pole kursu, lewa krawędź pola od marginesu w cm, szerokość pola w cm). Treść strony ma 16 cm:
# linia kierownika podmiotu 0–4,8 cm, napis „Przewodniczący komisji” na środku, linia członków komisji 7,6–16 cm.
SLOTS = [
    ('entity_director',   0.1, 4.6),
    ('committee_chair',   5.3, 3.9),
    ('committee_member1', 9.4, 3.3),
    ('committee_member2', 12.7, 3.3),
]
BOX_HEIGHT = 1.5   # cm
LINE_OFFSET = 0.3  # cm — dół pieczątki tuż nad kropkami linii podpisu

EMU_PER_CM = 360000


class StampError(Exception):
    pass


def _pdf_first_page(upload):
    import pypdfium2 as pdfium
    try:
        pdf = pdfium.PdfDocument(upload.read())
    except Exception:
        raise StampError('Nie udało się odczytać pliku PDF.')
    try:
        if len(pdf) == 0:
            raise StampError('Plik PDF nie ma stron.')
        return pdf[0].render(scale=PDF_DPI / 72).to_pil()
    finally:
        pdf.close()


def prepare_stamp(upload):
    """Skan (JPG / PNG / PDF) → PNG: białe tło przezroczyste, przycięte marginesy, zmniejszony. Zwraca bajty."""
    if upload.size > MAX_UPLOAD:
        raise StampError('Plik jest za duży (maks. 10 MB).')
    head = upload.read(5)
    upload.seek(0)
    if head.startswith(b'%PDF'):
        img = _pdf_first_page(upload)
    else:
        try:
            img = Image.open(upload)
            img.load()
        except Exception:
            raise StampError('To nie jest obraz. Dodaj skan pieczątki jako JPG, PNG lub PDF.')
        if img.format not in ('JPEG', 'PNG'):
            raise StampError('Dozwolone pliki: JPG, PNG, PDF.')

    img = ImageOps.exif_transpose(img).convert('RGBA')
    img.thumbnail((MAX_SIDE * 2, MAX_SIDE * 2))
    r, g, b, a = img.split()
    darkest = ImageChops.darker(ImageChops.darker(r, g), b)
    keep = darkest.point(lambda v: 0 if v >= WHITE_THRESHOLD else 255)
    img.putalpha(ImageChops.multiply(a, keep))
    bbox = img.getchannel('A').getbbox()
    if not bbox:
        raise StampError('Na obrazie nie widać pieczątki (sama biel).')
    img = img.crop(bbox)
    img.thumbnail((MAX_SIDE, MAX_SIDE))

    out = BytesIO()
    img.save(out, format='PNG', optimize=True)
    return out.getvalue()


def _instructor_by_name(name, instructors):
    name = (name or '').strip()
    if not name:
        return None
    return next((i for i in instructors if name in i.committee_names()), None)


def course_stamps(course):
    """[(lewa krawędź cm, szerokość cm, ścieżka do PNG)] dla osób kursu, które mają pieczątkę."""
    if course is None:
        return []
    instructors = [i for i in Instructor.objects.exclude(stamp='', director_stamp='') if i.stamp or i.director_stamp]
    result = []
    for field, left, width in SLOTS:
        inst = _instructor_by_name(getattr(course, field, ''), instructors)
        if inst is None:
            continue
        # Kierownik podmiotu: własna pieczątka do tej roli, jeśli jest
        candidates = [inst.director_stamp, inst.stamp] if field == 'entity_director' else [inst.stamp]
        stamp = next((s for s in candidates if s and s.storage.exists(s.name)), None)
        if stamp:
            result.append((left, width, stamp.path))
    return result


def stamps_cache_key(stamps):
    """Do klucza cache PDF-ów — nowa pieczątka ma nową nazwę pliku."""
    return [path for _, _, path in stamps]


def _signature_paragraph(document):
    """Akapit z kropkowanymi liniami podpisów (kierownik podmiotu / członkowie komisji)."""
    for p in reversed(document.paragraphs):
        if '.' * 20 in p.text and '…' in p.text:
            return p
    return None


def _fit(path, max_w_cm, max_h_cm):
    with Image.open(path) as img:
        w, h = img.size
    scale = min(max_w_cm / w, max_h_cm / h)
    return w * scale, h * scale


def _float_picture(paragraph, path, left_cm, top_cm, width_cm, height_cm, pic_id):
    """Obraz zakotwiczony w akapicie, ustawiony względem marginesu (nie przesuwa tekstu)."""
    run = paragraph.add_run()
    run.add_picture(path, width=Cm(width_cm), height=Cm(height_cm))
    inline = run._r.xpath('.//wp:inline')[0]
    graphic = inline.xpath('./a:graphic')[0]
    cx, cy = int(width_cm * EMU_PER_CM), int(height_cm * EMU_PER_CM)
    anchor = parse_xml(
        f'<wp:anchor {nsdecls("wp", "a", "pic", "r")} distT="0" distB="0" distL="0" distR="0" simplePos="0" '
        f'relativeHeight="{251700000 + pic_id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">'
        f'<wp:simplePos x="0" y="0"/>'
        f'<wp:positionH relativeFrom="margin"><wp:posOffset>{int(left_cm * EMU_PER_CM)}</wp:posOffset></wp:positionH>'
        f'<wp:positionV relativeFrom="paragraph"><wp:posOffset>{int(top_cm * EMU_PER_CM)}</wp:posOffset></wp:positionV>'
        f'<wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
        f'<wp:docPr id="{9000 + pic_id}" name="Pieczatka {pic_id}"/><wp:cNvGraphicFramePr/>'
        f'</wp:anchor>'
    )
    anchor.append(graphic)
    inline.getparent().replace(inline, anchor)


def add_stamps(document, stamps):
    """Wstawia pieczątki do wypełnionego certyfikatu (python-docx Document)."""
    if not stamps:
        return
    paragraph = _signature_paragraph(document)
    if paragraph is None:
        return
    for n, (left, box_w, path) in enumerate(stamps, start=1):
        w, h = _fit(path, box_w, BOX_HEIGHT)
        x = left + (box_w - w) / 2
        y = LINE_OFFSET - h
        _float_picture(paragraph, path, x, y, w, h, n)
