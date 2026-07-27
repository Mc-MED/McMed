from pathlib import Path
from email.mime.image import MIMEImage

from django.core.mail import EmailMultiAlternatives
from django.conf import settings

LOGO_PATH = Path(__file__).parent / 'logo.png'


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
        '<img src="cid:mcmed_logo" alt="Mc Med" height="56" style="display:block;margin:0 auto;">'
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
          <td style="background:#c41230;padding:28px 40px;text-align:center;">
            {logo_img}
            <div style="font-size:10px;color:#fca5a5;margin-top:8px;
                        letter-spacing:2px;text-transform:uppercase;">Kwalifikowana Pierwsza Pomoc</div>
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
            <div style="font-size:11px;color:#4b5563;line-height:1.7;">
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
        with open(LOGO_PATH, 'rb') as f:
            logo = MIMEImage(f.read())
        logo.add_header('Content-ID', '<mcmed_logo>')
        logo.add_header('Content-Disposition', 'inline', filename='logo.png')
        msg.attach(logo)

    msg.send(fail_silently=True)
