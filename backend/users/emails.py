from io import BytesIO
from pathlib import Path
from email.mime.image import MIMEImage

from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from PIL import Image

LOGO_PATH = Path(__file__).parent / 'logo.png'


def _logo_transparent_bytes():
    """Zwraca logo jako białe logo na przezroczystym tle."""
    img = Image.open(LOGO_PATH).convert('RGBA')
    pixels = img.getdata()
    new_pixels = [
        (255, 255, 255, 0) if (r > 220 and g > 220 and b > 220) else (255, 255, 255, a)
        for r, g, b, a in pixels
    ]
    img.putdata(new_pixels)
    buf = BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def _html(first_name, activation_link, course_info, resend):
    subtext = (
        'Twoje zgłoszenie zostało przyjęte. Aktywuj konto, aby uzyskać dostęp do platformy.'
        if not resend else
        'Na prośbę wysłaliśmy nowy link aktywacyjny. Poprzedni link został unieważniony.'
    )

    # --- blok z danymi kursu ---
    course_block = ''
    if course_info:
        rows = ''.join(
            f'''<tr>
                  <td style="padding:5px 0;font-size:13px;color:#6b7280;white-space:nowrap;padding-right:16px;">{k}</td>
                  <td style="padding:5px 0;font-size:13px;color:#111827;font-weight:600;">{v}</td>
                </tr>'''
            for k, v in course_info.items()
        )
        course_block = f'''
        <tr>
          <td style="background:#ffffff;padding:0 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;">
              <tr><td style="padding:18px 22px;">
                <div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;
                            letter-spacing:1.5px;margin-bottom:12px;">Szczegóły kursu</div>
                <table cellpadding="0" cellspacing="0">{rows}</table>
              </td></tr>
            </table>
          </td>
        </tr>'''

    # --- kroki ---
    steps = [
        ('Aktywuj konto',      'Kliknij przycisk poniżej i zaloguj się na swoim nowym koncie.'),
        ('Potwierdź zapis',    'Zadzwonimy do Ciebie telefonicznie, aby potwierdzić udział w kursie.'),
        ('Materiały i wyniki', 'Na koncie znajdziesz harmonogram, podręczniki i wyniki egzaminu.'),
    ]
    steps_rows = ''
    for i, (title, desc) in enumerate(steps, 1):
        steps_rows += f'''
          <tr>
            <td valign="top" width="36" style="padding-bottom:18px;">
              <div style="width:30px;height:30px;background:#dc2626;border-radius:50%;
                          text-align:center;line-height:30px;font-size:13px;
                          font-weight:700;color:#ffffff;">{i}</div>
            </td>
            <td style="padding-left:12px;padding-bottom:18px;">
              <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:2px;">{title}</div>
              <div style="font-size:13px;color:#6b7280;line-height:1.6;">{desc}</div>
            </td>
          </tr>'''

    # Logo: jeśli plik istnieje – CID, w przeciwnym razie fallback tekstowy
    logo_img = (
        '<img src="cid:mcmed_logo" alt="Mc Med" width="99" height="110"'
        ' style="display:block;width:99px;height:110px;">'
        if LOGO_PATH.exists() else
        '<span style="font-size:30px;font-weight:900;color:#ffffff;font-family:Georgia,Times,serif;">Mc Med</span>'
    )

    return f'''<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:#c41230;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="25%" valign="middle">
                  {logo_img}
                </td>
                <td width="75%" valign="middle" style="text-align:center;">
                  <div style="font-size:22px;font-weight:900;color:#ffffff;font-family:Georgia,Times,serif;
                              letter-spacing:0.5px;">Mc Med</div>
                  <div style="font-size:18px;font-weight:700;color:#fca5a5;margin-top:2px;
                              letter-spacing:0.5px;">Kwalifikowana Pierwsza Pomoc</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── HERO ── -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 24px;text-align:center;">
            <div style="width:68px;height:68px;background:#dcfce7;border-radius:50%;
                        margin:0 auto 22px;font-size:34px;line-height:68px;text-align:center;">✓</div>
            <h1 style="margin:0 0 10px;font-size:28px;font-weight:900;color:#111827;
                       font-family:Georgia,Times,serif;">Gratulacje, {first_name}!</h1>
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">{subtext}</p>
          </td>
        </tr>

        {course_block}

        <!-- ── CTA ── -->
        <tr>
          <td style="background:#ffffff;padding:4px 40px 36px;text-align:center;">
            <a href="{activation_link}"
               style="display:inline-block;background:#dc2626;color:#ffffff;
                      font-size:16px;font-weight:700;padding:15px 44px;
                      border-radius:12px;text-decoration:none;letter-spacing:0.2px;">
              Aktywuj konto &#8594;
            </a>
            <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">
              Link wygasa po 72&nbsp;godzinach.<br>
              Jeśli przycisk nie działa, skopiuj ten adres do przeglądarki:<br>
              <a href="{activation_link}"
                 style="color:#dc2626;word-break:break-all;">{activation_link}</a>
            </p>
          </td>
        </tr>

        <!-- ── DIVIDER ── -->
        <tr>
          <td style="background:#ffffff;padding:0 40px;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>

        <!-- ── KROKI ── -->
        <tr>
          <td style="background:#ffffff;padding:28px 40px 36px;">
            <div style="font-size:10px;font-weight:700;color:#9ca3af;
                        text-transform:uppercase;letter-spacing:1.5px;margin-bottom:20px;">Co dalej?</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              {steps_rows}
            </table>
          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#111827;padding:24px 40px;text-align:center;
                     border-radius:0 0 20px 20px;">
            <div style="font-size:11px;color:#9ca3af;line-height:1.7;">
              Ten e-mail został wysłany automatycznie &#8211; prosimy na niego nie odpowiadać.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>'''


def _plain(first_name, activation_link, course_info, resend):
    lines = [f'Dzień dobry {first_name},\n']
    if not resend:
        lines.append('Twoje zgłoszenie na kurs zostało przyjęte!\n')
    else:
        lines.append('Wysyłamy ponownie link aktywacyjny dla Twojego konta w Mc Med.\n')
    if course_info:
        for k, v in course_info.items():
            lines.append(f'{k}: {v}')
        lines.append('')
    lines += [
        'Aktywuj swoje konto:',
        activation_link,
        '',
        'Link ważny przez 72 godziny.',
        '',
        'Co dalej?',
        '1. Kliknij link powyżej, aby aktywować konto.',
        '2. Zadzwonimy do Ciebie, aby potwierdzić zapis.',
        '3. Na koncie znajdziesz materiały szkoleniowe i wyniki egzaminu.',
        '',
        'Pozdrawiamy,',
        'Zespół Mc Med',
    ]
    return '\n'.join(lines)


def _html_course_email(first_name, subject, body, course_info):
    rows = ''
    if course_info:
        rows = ''.join(
            f'''<tr>
                  <td style="padding:5px 0;font-size:13px;color:#6b7280;white-space:nowrap;padding-right:16px;">{k}</td>
                  <td style="padding:5px 0;font-size:13px;color:#111827;font-weight:600;">{v}</td>
                </tr>'''
            for k, v in course_info.items()
        )
        course_block = f'''
        <tr>
          <td style="background:#ffffff;padding:0 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;">
              <tr><td style="padding:18px 22px;">
                <div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;
                            letter-spacing:1.5px;margin-bottom:12px;">Szczegóły kursu</div>
                <table cellpadding="0" cellspacing="0">{rows}</table>
              </td></tr>
            </table>
          </td>
        </tr>'''
    else:
        course_block = ''

    body_html = body.replace('\n', '<br>')

    logo_img = (
        '<img src="cid:mcmed_logo" alt="Mc Med" width="99" height="110"'
        ' style="display:block;width:99px;height:110px;">'
        if LOGO_PATH.exists() else
        '<span style="font-size:30px;font-weight:900;color:#ffffff;font-family:Georgia,Times,serif;">Mc Med</span>'
    )

    return f'''<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:#c41230;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="25%" valign="middle">
                  {logo_img}
                </td>
                <td width="75%" valign="middle" style="text-align:center;">
                  <div style="font-size:22px;font-weight:900;color:#ffffff;font-family:Georgia,Times,serif;
                              letter-spacing:0.5px;">Mc Med</div>
                  <div style="font-size:18px;font-weight:700;color:#fca5a5;margin-top:2px;
                              letter-spacing:0.5px;">Kwalifikowana Pierwsza Pomoc</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── HERO ── -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 24px;text-align:center;">
            <div style="width:68px;height:68px;background:#fef2f2;border-radius:50%;
                        margin:0 auto 22px;font-size:34px;line-height:68px;text-align:center;">✉</div>
            <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#111827;
                       font-family:Georgia,Times,serif;">{subject}</h1>
            <p style="margin:0;font-size:13px;color:#6b7280;">Wiadomość dla: {first_name}</p>
          </td>
        </tr>

        <!-- ── TREŚĆ ── -->
        <tr>
          <td style="background:#ffffff;padding:8px 40px 28px;">
            <div style="font-size:15px;color:#374151;line-height:1.8;white-space:pre-wrap;">{body_html}</div>
          </td>
        </tr>

        {course_block}

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#111827;padding:24px 40px;text-align:center;
                     border-radius:0 0 20px 20px;">
            <div style="font-size:11px;color:#9ca3af;line-height:1.7;">
              Ten e-mail został wysłany automatycznie &#8211; prosimy na niego nie odpowiadać.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>'''


def send_course_email(*, to_email, first_name, subject, body, course_info=None):
    """Wysyła HTML-owy mail od admina do uczestnika kursu."""
    msg = EmailMultiAlternatives(
        subject=subject,
        body=f'Dzień dobry {first_name},\n\n{body}\n\nPozdrawiamy,\nZespół Mc Med',
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    msg.mixed_subtype = 'related'
    msg.attach_alternative(
        _html_course_email(first_name, subject, body, course_info),
        'text/html',
    )
    if LOGO_PATH.exists():
        logo = MIMEImage(_logo_transparent_bytes(), _subtype='png')
        logo.add_header('Content-ID', '<mcmed_logo>')
        logo.add_header('Content-Disposition', 'inline', filename='logo.png')
        msg.attach(logo)
    msg.send(fail_silently=True)


def _html_password_reset(first_name, reset_link):
    logo_img = (
        '<img src="cid:mcmed_logo" alt="Mc Med" width="99" height="110"'
        ' style="display:block;width:99px;height:110px;">'
        if LOGO_PATH.exists() else
        '<span style="font-size:30px;font-weight:900;color:#ffffff;font-family:Georgia,Times,serif;">Mc Med</span>'
    )
    return f'''<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;">
        <tr>
          <td style="background:#c41230;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="25%" valign="middle">{logo_img}</td>
                <td width="75%" valign="middle" style="text-align:center;">
                  <div style="font-size:22px;font-weight:900;color:#ffffff;font-family:Georgia,Times,serif;letter-spacing:0.5px;">Mc Med</div>
                  <div style="font-size:18px;font-weight:700;color:#fca5a5;margin-top:2px;letter-spacing:0.5px;">Kwalifikowana Pierwsza Pomoc</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:40px 40px 24px;text-align:center;">
            <div style="width:68px;height:68px;background:#fef2f2;border-radius:50%;margin:0 auto 22px;font-size:34px;line-height:68px;text-align:center;">&#128273;</div>
            <h1 style="margin:0 0 10px;font-size:28px;font-weight:900;color:#111827;font-family:Georgia,Times,serif;">Resetowanie has&#322;a</h1>
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
              Cze&#347;&#263;, {first_name}! Otrzymali&#347;my pro&#347;b&#281; o zmian&#281; has&#322;a do Twojego konta w Mc Med.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:4px 40px 36px;text-align:center;">
            <a href="{reset_link}"
               style="display:inline-block;background:#dc2626;color:#ffffff;font-size:16px;font-weight:700;padding:15px 44px;border-radius:12px;text-decoration:none;letter-spacing:0.2px;">
              Ustaw nowe has&#322;o &#8594;
            </a>
            <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">
              Link wygasa po 2&nbsp;godzinach.<br>
              Je&#347;li przycisk nie dzia&#322;a, skopiuj ten adres do przegl&#261;darki:<br>
              <a href="{reset_link}" style="color:#dc2626;word-break:break-all;">{reset_link}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:0 40px 36px;">
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Je&#347;li to nie Ty prosi&#322;e&#347;/a&#347; o zmian&#281; has&#322;a &#8212; zignoruj t&#281; wiadomo&#347;&#263;. Twoje has&#322;o nie zosta&#322;o zmienione.
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#111827;padding:24px 40px;text-align:center;border-radius:0 0 20px 20px;">
            <div style="font-size:11px;color:#9ca3af;line-height:1.7;">
              Ten e-mail zosta&#322; wys&#322;any automatycznie &#8211; prosimy na niego nie odpowiada&#263;.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>'''


def send_password_reset_email(*, to_email, first_name, reset_link):
    """Wysyła HTML-owy mail z linkiem do resetowania hasła."""
    plain = (
        f'Dzień dobry {first_name},\n\n'
        'Otrzymaliśmy prośbę o zmianę hasła do Twojego konta w Mc Med.\n\n'
        f'Kliknij poniższy link, aby ustawić nowe hasło:\n{reset_link}\n\n'
        'Link wygasa po 2 godzinach.\n\n'
        'Jeśli to nie Ty prosiłeś/aś o zmianę hasła – zignoruj tę wiadomość.\n\n'
        'Pozdrawiamy,\nZespół Mc Med'
    )
    msg = EmailMultiAlternatives(
        subject='Resetowanie hasła – Mc Med',
        body=plain,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )
    msg.mixed_subtype = 'related'
    msg.attach_alternative(_html_password_reset(first_name, reset_link), 'text/html')
    if LOGO_PATH.exists():
        logo = MIMEImage(_logo_transparent_bytes(), _subtype='png')
        logo.add_header('Content-ID', '<mcmed_logo>')
        logo.add_header('Content-Disposition', 'inline', filename='logo.png')
        msg.attach(logo)
    msg.send(fail_silently=True)


def send_activation_email(*, to_email, first_name, activation_link, course_info=None, resend=False):
    """Wysyła HTML-owy mail z linkiem aktywacyjnym.

    course_info – opcjonalny słownik {etykieta: wartość} z danymi kursu.
    resend      – True jeśli to ponowne wysłanie (zmienia nagłówek i tekst).
    """
    subject = (
        'Ponowna aktywacja konta – Mc Med'
        if resend else
        'Potwierdzenie zapisu i aktywacja konta – Mc Med'
    )
    msg = EmailMultiAlternatives(
        subject=subject,
        body=_plain(first_name, activation_link, course_info, resend),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
    )

    # Osadź HTML i logo jako powiązane części (multipart/related)
    msg.mixed_subtype = 'related'
    msg.attach_alternative(
        _html(first_name, activation_link, course_info, resend),
        'text/html',
    )

    if LOGO_PATH.exists():
        logo = MIMEImage(_logo_transparent_bytes(), _subtype='png')
        logo.add_header('Content-ID', '<mcmed_logo>')
        logo.add_header('Content-Disposition', 'inline', filename='logo.png')
        msg.attach(logo)

    msg.send(fail_silently=True)
