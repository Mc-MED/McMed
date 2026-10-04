# McMed – Platforma zarządzania kursami KPP

Aplikacja webowa dla firmy szkoleniowej Mc Med prowadzącej kursy Kwalifikowanej Pierwszej Pomocy (KPP) i recertyfikacje.

## Stack technologiczny

**Backend** – `backend/`
- Django 5.1 + Django REST Framework
- JWT auth: `djangorestframework-simplejwt`
- Baza danych: PostgreSQL (psycopg2-binary)
- Konfiguracja: `python-decouple` (plik `.env`)
- Dev server: `python manage.py runserver` → port 8000

**Frontend** – `frontend/`
- React 19 + Vite (port 3000)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Routing: `react-router-dom` 7
- HTTP: `axios` (proxy `/api` → `localhost:8000` skonfigurowane w `vite.config.js`)
- Build: `npm run build`, dev: `npm run dev`

**Strona główna** – `index.html` (statyczny HTML/CSS/JS, bez frameworka)

## Jak uruchomić

```bash
# Backend
cd backend
.\venv\Scripts\python.exe manage.py runserver

# Frontend (osobny terminal)
cd frontend
npm run dev
```

## Struktura projektu

```
McMed/
├── index.html              # Landing page (statyczna, bez frameworka)
├── logomc.svg              # Logo
├── backend/
│   ├── config/             # settings.py, urls.py, wsgi.py
│   ├── courses/            # App kursów i zapisów
│   ├── users/              # App użytkowników (puste – do zrobienia)
│   ├── documents/          # App dokumentów (puste – do zrobienia)
│   ├── notifications/      # App powiadomień (puste – do zrobienia)
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api/
        │   ├── courses.js  # fetchCourses, submitEnrollment (publiczne)
        │   ├── admin.js    # adminFetchCourses/Course/Enrollments, create/update/delete (JWT)
        │   └── instructor.js # panel prowadzącego: fetchMe, kursy, uczestnicy, zapis ocen
        ├── data/
        │   └── kppQuestions.js # 280 pytań do nauki (źródło: backend/documents/templates/pytania.pdf)
        ├── layouts/
        │   ├── AdminLayout.jsx
        │   └── InstructorLayout.jsx
        ├── pages/
        │   ├── Login.jsx           # Logowanie → JWT zapisywany w localStorage
        │   ├── NotFound.jsx
        │   ├── admin/
        │   │   ├── Dashboard.jsx       # Statystyki (stub)
        │   │   ├── CourseList.jsx      # Lista kursów, klik → szczegóły
        │   │   ├── CourseCreate.jsx    # Formularz tworzenia kursu
        │   │   ├── CourseDetail.jsx    # Szczegóły kursu + edycja + uczestnicy + Egzamin (ExamTab)
        │   │   └── InstructorList.jsx  # Instruktorzy + zaproszenie do panelu prowadzącego
        │   ├── instructor/
        │   │   ├── CourseList.jsx      # Kursy prowadzącego
        │   │   └── CourseDetail.jsx    # Uczestnicy + Egzamin (ExamTab z panelu admina)
        │   └── participant/
        │       └── EnrollForm.jsx      # Publiczny formularz zapisu na kurs
        └── index.css       # Globalne klasy: .field-label, .field-input
```

## Routing (frontend)

| Ścieżka | Widok | Auth |
|---|---|---|
| `/login` | Login.jsx | Publiczny |
| `/zapisz-sie` | EnrollForm.jsx | Publiczny |
| `/admin` | Dashboard.jsx | JWT |
| `/admin/courses` | CourseList.jsx | JWT |
| `/admin/courses/create` | CourseCreate.jsx | JWT |
| `/admin/courses/:id` | CourseDetail.jsx | JWT |
| `/admin/participants` | ParticipantList.jsx | JWT |
| `/admin/instructors` | InstructorList.jsx | JWT |
| `/reset-hasla/:token` | participant/ResetPassword.jsx (też ustawienie hasła z zaproszenia, `?panel=prowadzacy`) | Publiczny |
| `/prowadzacy` | Login.jsx (logowanie prowadzącego) | Publiczny |
| `/prowadzacy/kursy` | instructor/CourseList.jsx | JWT (prowadzący) |
| `/prowadzacy/kursy/:id` | instructor/CourseDetail.jsx – Uczestnicy + Egzamin | JWT (prowadzący) |

## API endpoints

### Publiczne (AllowAny)
| Metoda | URL | Opis |
|---|---|---|
| GET | `/api/courses/` | Lista aktywnych kursów |
| POST | `/api/courses/enrollments/` | Zapis uczestnika na kurs |

### Wymagają JWT (IsAuthenticated)
| Metoda | URL | Opis |
|---|---|---|
| GET | `/api/courses/admin/` | Lista wszystkich kursów |
| POST | `/api/courses/admin/create/` | Utwórz kurs |
| GET/PATCH | `/api/courses/admin/:id/` | Szczegóły / edycja kursu |
| GET | `/api/courses/enrollments/list/` | Lista zapisów (opcjonalnie `?course=id`) |
| DELETE | `/api/courses/enrollments/:id/` | Usuń zapis uczestnika |
| POST | `/api/courses/instructors/:id/invite/` | Załóż konto prowadzącego i wyślij link do ustawienia hasła (72 h) |

### Panel prowadzącego (konto powiązane z `Instructor.user`)
| Metoda | URL | Opis |
|---|---|---|
| GET | `/api/users/me/` | Rola zalogowanego: admin / instructor / participant |
| GET | `/api/courses/instructor/` | Kursy prowadzącego (prowadzący kursu lub członek komisji) |
| GET | `/api/courses/instructor/:id/` | Szczegóły kursu |
| GET | `/api/courses/instructor/:id/enrollments/` | Uczestnicy: imię, nazwisko, telefon, email, oceny |
| PATCH | `/api/courses/instructor/enrollments/:id/` | Tylko własne oceny praktyczne członka komisji: `exam_<chair\|member1\|member2>_<rko\|zad1\|zad2>`; średnia trafia do `exam_committee_<rola>` (zbiorczy) |

### Auth
| Metoda | URL | Opis |
|---|---|---|
| POST | `/api/auth/token/` | Pobierz JWT (username + password) |
| POST | `/api/auth/token/refresh/` | Odśwież token |

Token przechowywany w `localStorage` jako `access_token` i `refresh_token`.

Linki w mailach (zaproszenie prowadzącego, reset hasła) budowane są z `FRONTEND_URL` w `backend/.env` — w dev `http://localhost:3000` (Vite). Django na porcie 8000 serwuje SPA tylko z `backend/frontend_build/` (build produkcyjny); bez niego zwraca 404.

## Modele Django

### Instructor
Pola: `first_name`, `last_name`, `title`, `profession`, specjalizacje `spec_*`, `years_experience`, `email`, `user` (OneToOne → konto w panelu prowadzącego, `related_name='instructor_profile'`).

Metody: `panel_courses()` — kursy, w których jest prowadzącym lub w komisji; `committee_roles(course)` — role w komisji kursu (`chair` / `member1` / `member2`). Komisja w `Course` to tekst, więc dopasowanie jest po imieniu i nazwisku (z tytułem lub bez).

### Course
Pola: `name`, `course_type` (kpp/recert), `city`, `max_participants`, `price`, `is_active`, `created_at`, `course_days` (JSONField, 6 dat), `start_date`/`end_date` (auto z course_days), `exam_date`, `exam_location`, `entity_director`, `academic_director`, `instructors` (M2M → Instructor), `psychologist`, `committee_chair`, `committee_member1`, `committee_member2` (tekst: imię i nazwisko z listy instruktorów).

Properties: `spots_left`, `is_full`, `instructors_count` (ceil(max_participants/6)).

### Enrollment
Pola: `course` (FK), `first_name`, `last_name`, `pesel`, `birth_date`, `email`, `phone`, `zip_code`, `city`, `street`, `house_number`, `apartment_number` (opcjonalne), `photo_consent`, `created_at`.

Egzamin (skala ocen 3; 3,5; 4; 4,5; 5, teoretyczna ocena końcowa także 2):
- Teoretyczny: `exam_theory_attempt1`, `exam_theory_attempt2` (punkty /30), `exam_theory_grade`.
- Praktyczny: każdy członek komisji ma własne oceny `exam_<chair|member1|member2>_<rko|zad1|zad2>`.
- Zbiorczy: `exam_committee_chair`, `exam_committee_member1`, `exam_committee_member2`.
- `exam_rko`, `exam_zad1`, `exam_zad2` — wyliczane (średnia zadania od całej komisji), tylko do odczytu; używa ich karta „EGZ praktyczny” w `egzamin.xlsx`.

Po zapisie ocen praktycznych członka komisji serializer wywołuje `Enrollment.recompute_practical_grades(roles)`: średnia jego trzech ocen (zaokrąglona do 0,5, połówki w górę — `round_grade`) trafia do jego kolumny w zbiorczym. Admin może ręcznie poprawić ocenę zbiorczą, ale kolejna zmiana ocen praktycznych tego członka ją nadpisze.

## Co zostało zrobione

### Landing page (index.html)
- Pełna strona z sekcjami: Navbar, Hero, O nas, Co to jest KPP, Recertyfikacja, Galeria, Najbliższe kursy, Footer
- Animacje CSS: fade-in tekstu w hero, pływające logo, obracający się pierścień, scroll reveal sekcji
- Animowane liczniki statystyk (IntersectionObserver)
- Sekcja **Galeria** – mozaikowy grid 4 kolumny, hover z czerwoną nakładką, lightbox po kliknięciu
- Nawigacja: O nas, KPP, Recertyfikacja, Galeria, Zapisz się na kurs
- Przyciski "Zapisz się" na kartach kursów → `http://localhost:3000/zapisz-sie`

### Formularz zapisu (publiczny)
- Sekcje: Wybór kursu (dropdown z API), Dane osobowe, Adres, Utwórz konto, Zgody
- Pola osobowe: imię, nazwisko, PESEL, data urodzenia, email, telefon
- Adres: kod pocztowy, miejscowość, ulica, nr domu, nr mieszkania
- Konto: login, hasło, powtórz hasło (UI only – backend nie podpięty jeszcze)
- Zgoda na zdjęcia
- Walidacja po stronie klienta + obsługa błędów z serwera
- Ekran sukcesu po zapisaniu

### Panel admina
- Login z JWT (username, nie email)
- **Dashboard** – statystyki (stub)
- **Lista kursów** – tabela z klikiem w wiersz → szczegóły kursu
- **Formularz tworzenia kursu** – 5 sekcji: ogólne, terminy (6 dat), organizacja, prowadzący (dynamicznie 1 na 6 kursantów), komisja egzaminacyjna + psycholog. Przycisk "Wstaw dane testowe".
- **Szczegóły kursu** – dwie zakładki:
  - *Dane kursu*: edytowalny formularz, przycisk "Zapisz zmiany" (PATCH)
  - *Uczestnicy*: tabela z usuwaniem (potwierdzenie inline)
- **Lista uczestników** – tabela wszystkich zapisów z filtrem po kursie
- **Instruktorzy** – lista instruktorów; przycisk zaproszenia zakłada konto (login = email) i wysyła link do ustawienia hasła ważny 72 h

### Egzamin (zakładka w szczegółach kursu, komponent `ExamTab`)
- Podzakładki: *Teoretyczny* (punkty z dwóch podejść + ocena końcowa), *Praktyczny*, *Zbiorczy*; kolumna „Średnia” w praktycznym i zbiorczym.
- *Praktyczny*: admin przełącza się między członkami komisji i może wpisać oceny za każdego (np. z papierowej karty).
- *Zbiorczy*: kolumny członków komisji wypełniają się same ze średnich z praktycznego; ocena końcowa = średnia z trzech kolumn.
- „Wypełnij losowo” (tylko admin) — losowe wyniki w bieżącej podzakładce; teoretyczny: 27–30 pkt i ocena 5.
- Dokument `egzamin.xlsx` (zakładka Dokumenty) — karty oceny wypełniane ocenami z tej zakładki.
- Recertyfikacja: `obsluga-egzaminu-rec.xlsx` działa tak samo (wiersz-szablon `{{p_…}}` w kartach oceny i w zestawieniu), dodatkowo arkusz `DANE` z listą uczestników i numerami przedkładanych zaświadczeń.

### Panel prowadzącego (`/prowadzacy`)
- Konto zakłada admin zaproszeniem z listy instruktorów; `GET /api/users/me/` zwraca rolę `instructor`, uprawnienie `IsInstructor` (`courses/permissions.py`).
- Prowadzący widzi kursy, w których prowadzi zajęcia lub jest w komisji; zakładki *Uczestnicy* (kontakt) i *Egzamin*.
- W *Praktycznym* członek komisji widzi i wpisuje tylko swoje oceny RKO / ZAD 1 / ZAD 2 (rola z `my_committee_roles` kursu); teoretyczny i zbiorczy tylko do odczytu. Prowadzący spoza komisji nie wpisuje ocen.
- Backend pilnuje tego sam: `InstructorEnrollmentDetailView` przekazuje serializerowi `editable_fields` z ról w komisji, pozostałe pola są ignorowane.

## Do zrobienia (następne kroki)
- `users/` – model użytkownika uczestnika, rejestracja konta przy zapisie na kurs
- `notifications/` – SMS/email przypomnienia o recertyfikacji (3 miesiące przed wygaśnięciem)
- `documents/` – materiały szkoleniowe, certyfikaty
- Login uczestnika (oddzielny od admina)
- Dashboard uczestnika (historia kursów, certyfikat, materiały)
- Podpięcie konta uczestnika do formularza zapisu
- Dynamiczne ładowanie kursów na landing page (zastąpienie hardkodowanych kart)
