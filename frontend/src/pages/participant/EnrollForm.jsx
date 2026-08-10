import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchCourses, submitEnrollment, resendActivation } from '../../api/courses'
import { fetchMyProfile, enrollMe } from '../../api/participant'

const EMPTY = {
  course: '',
  first_name: '',
  last_name: '',
  pesel: '',
  birth_date: '',
  email: '',
  phone: '',
  zip_code: '',
  city: '',
  street: '',
  house_number: '',
  apartment_number: '',
  password: '',
  confirm_password: '',
  photo_consent: false,
  data_consent: false,
}

export default function EnrollForm() {
  const [searchParams] = useSearchParams()
  const [courses, setCourses]   = useState([])
  const [form, setForm]         = useState({ ...EMPTY, course: searchParams.get('kurs') || '' })
  const [errors, setErrors]     = useState({})
  const [status, setStatus]     = useState('idle') // idle | loading | success | error
  const [serverError, setServerError] = useState('')
  const [enrolledEmail, setEnrolledEmail] = useState('')
  const [resendState, setResendState] = useState('idle') // idle | loading | sent | error

  // Zalogowany uczestnik
  const [isLoggedIn, setIsLoggedIn]   = useState(() => !!localStorage.getItem('participant_access_token'))
  const [accountEmail, setAccountEmail] = useState('')
  const [profile, setProfile]         = useState(null)
  const [profileLoading, setProfileLoading] = useState(() => !!localStorage.getItem('participant_access_token'))
  const [quickCourse, setQuickCourse] = useState(searchParams.get('kurs') || '')
  const [quickError, setQuickError]   = useState('')

  useEffect(() => {
    fetchCourses().then(setCourses).catch(() => {})
    const token = localStorage.getItem('participant_access_token')
    if (token) {
      setIsLoggedIn(true)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const email = payload.email || payload.username || ''
        setAccountEmail(email)
        setForm(f => ({ ...f, email }))
      } catch {}
      fetchMyProfile()
        .then(setProfile)
        .catch(() => {})
        .finally(() => setProfileLoading(false))
    }
  }, [])

  function formatDate(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    setErrors(er => ({ ...er, [name]: '' }))
  }

  function validate() {
    const e = {}
    if (!form.course)        e.course       = 'Wybierz kurs.'
    if (!form.first_name.trim()) e.first_name = 'Podaj imię.'
    if (!form.last_name.trim())  e.last_name  = 'Podaj nazwisko.'
    if (!/^\d{11}$/.test(form.pesel)) e.pesel = 'PESEL musi mieć 11 cyfr.'
    if (!form.birth_date)    e.birth_date   = 'Podaj datę urodzenia.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Podaj poprawny adres email.'
    if (!form.phone.trim())  e.phone = 'Podaj numer telefonu.'
    if (!/^\d{2}-\d{3}$/.test(form.zip_code)) e.zip_code = 'Format: XX-XXX'
    if (!form.city.trim())       e.city       = 'Podaj miejscowość.'
    if (!form.street.trim())     e.street     = 'Podaj ulicę.'
    if (!form.house_number.trim()) e.house_number = 'Podaj numer domu.'
    if (!form.data_consent)        e.data_consent = 'Zgoda na przetwarzanie danych jest wymagana.'
    if (form.password.length < 8)  e.password = 'Hasło musi mieć min. 8 znaków.'
    if (form.password !== form.confirm_password) e.confirm_password = 'Hasła nie są zgodne.'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setStatus('loading')
    setServerError('')

    try {
      await submitEnrollment(form)
      setEnrolledEmail(form.email)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const fieldErrors = {}
        for (const [key, val] of Object.entries(data)) {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val
        }
        setErrors(fieldErrors)
        setServerError('')
      } else {
        setServerError('Wystąpił błąd. Spróbuj ponownie lub skontaktuj się z nami.')
      }
    }
  }

  async function handleResend() {
    setResendState('loading')
    try {
      await resendActivation(enrolledEmail)
      setResendState('sent')
    } catch {
      setResendState('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center shadow-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">Zapisano!</h2>

          {isLoggedIn ? (
            <>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Twoje zgłoszenie zostało przyjęte.
              </p>
              <a
                href="/konto"
                className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
              >
                Wróć do konta
              </a>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm leading-relaxed mb-2">
                Twoje zgłoszenie zostało przyjęte. Wysłaliśmy Ci link aktywacyjny
                do konta oraz potwierdzenie zapisu na adres{' '}
                <span className="font-medium text-gray-700">{enrolledEmail}</span>.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Skontaktujemy się z Tobą telefonicznie w celu potwierdzenia.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left mb-6">
                <p className="text-sm text-amber-800 leading-relaxed">
                  <span className="font-semibold">Nie widzisz maila?</span> Sprawdź folder{' '}
                  <span className="font-medium">SPAM</span> lub{' '}
                  <span className="font-medium">Oferty</span> – wiadomości aktywacyjne
                  czasem tam trafiają.
                </p>
              </div>

              <div className="mb-6">
                {resendState === 'sent' ? (
                  <p className="text-green-600 text-sm font-medium">Link został wysłany ponownie.</p>
                ) : resendState === 'error' ? (
                  <p className="text-red-500 text-sm">Wystąpił błąd. Spróbuj ponownie za chwilę.</p>
                ) : (
                  <div className="text-sm text-gray-400">
                    Nadal nic?{' '}
                    <button
                      onClick={handleResend}
                      disabled={resendState === 'loading'}
                      className="text-red-600 hover:text-red-700 font-medium underline underline-offset-2 disabled:opacity-50"
                    >
                      {resendState === 'loading' ? 'Wysyłanie…' : 'Wyślij link jeszcze raz'}
                    </button>
                  </div>
                )}
              </div>

              <a
                href="/"
                className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
              >
                Wróć na stronę główną
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  async function handleQuickEnroll(e) {
    e.preventDefault()
    if (!quickCourse) { setQuickError('Wybierz kurs.'); return }
    setQuickError('')
    setStatus('loading')
    try {
      await enrollMe(quickCourse)
      setEnrolledEmail(profile?.email || '')
      setStatus('success')
    } catch (err) {
      setStatus('idle')
      const data = err.response?.data
      setQuickError(data?.course || data?.error || 'Wystąpił błąd. Spróbuj ponownie.')
    }
  }

  async function handleFullLoggedInSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.course)                 errs.course       = 'Wybierz kurs.'
    if (!form.first_name.trim())      errs.first_name   = 'Podaj imię.'
    if (!form.last_name.trim())       errs.last_name    = 'Podaj nazwisko.'
    if (!/^\d{11}$/.test(form.pesel)) errs.pesel        = 'PESEL musi mieć 11 cyfr.'
    if (!form.birth_date)             errs.birth_date   = 'Podaj datę urodzenia.'
    if (!form.phone.trim())           errs.phone        = 'Podaj numer telefonu.'
    if (!/^\d{2}-\d{3}$/.test(form.zip_code)) errs.zip_code = 'Format: XX-XXX'
    if (!form.city.trim())            errs.city         = 'Podaj miejscowość.'
    if (!form.street.trim())          errs.street       = 'Podaj ulicę.'
    if (!form.house_number.trim())    errs.house_number = 'Podaj numer domu.'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setStatus('loading')
    try {
      await enrollMe(form.course, {
        first_name: form.first_name, last_name: form.last_name,
        pesel: form.pesel, birth_date: form.birth_date,
        email: form.email, phone: form.phone,
        zip_code: form.zip_code, city: form.city,
        street: form.street, house_number: form.house_number,
        apartment_number: form.apartment_number,
        photo_consent: form.photo_consent,
      })
      setEnrolledEmail(form.email || accountEmail)
      setStatus('success')
    } catch (err) {
      setStatus('idle')
      const data = err.response?.data
      if (data && typeof data === 'object') {
        setErrors(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])))
      } else {
        setServerError('Wystąpił błąd. Spróbuj ponownie.')
      }
    }
  }

  // Czekaj na załadowanie profilu żeby nie migotać między formularzami
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Ładowanie…</p>
      </div>
    )
  }

  // ── Uproszczony formularz dla zalogowanego uczestnika z profilem ──
  if (isLoggedIn && profile) {
    const selectedCourse = courses.find(c => String(c.id) === String(quickCourse))
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto mb-8">
          <a href="/konto" className="text-sm text-gray-400 hover:text-red-600 transition-colors">← Wróć do konta</a>
          <div className="flex items-center gap-3 mt-4 mb-1">
            <span className="text-2xl font-extrabold text-gray-900 tracking-tight">Mc Med</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mt-4 mb-1">Zapisz się na kurs</h1>
          <p className="text-gray-500 text-sm">Jesteś zalogowany — Twoje dane zostaną użyte automatycznie.</p>
        </div>

        <form onSubmit={handleQuickEnroll} className="max-w-2xl mx-auto space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4">Wybór kursu</h2>
            <select
              value={quickCourse}
              onChange={e => { setQuickCourse(e.target.value); setQuickError('') }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${quickError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            >
              <option value="">— Wybierz kurs —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id} disabled={c.is_full}>
                  {c.name} | {formatDate(c.start_date)}
                  {c.is_full ? ' (brak miejsc)' : ` | ${c.spots_left} miejsc`}
                </option>
              ))}
            </select>
            {quickError && <p className="text-red-500 text-xs mt-1">{quickError}</p>}
            {selectedCourse && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-100 text-sm text-gray-700 space-y-1">
                <div><span className="font-medium">Typ:</span> {selectedCourse.course_type_display}</div>
                <div><span className="font-medium">Termin:</span> {formatDate(selectedCourse.start_date)} – {formatDate(selectedCourse.end_date)}</div>
                <div><span className="font-medium">Miejsce:</span> {selectedCourse.city}</div>
                <div><span className="font-medium">Cena:</span> {selectedCourse.price} zł</div>
                <div><span className="font-medium">Wolne miejsca:</span> {selectedCourse.spots_left}</div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4">Twoje dane</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Info label="Imię i nazwisko" value={`${profile.first_name} ${profile.last_name}`} />
              <Info label="PESEL" value={profile.pesel} mono />
              <Info label="Telefon" value={profile.phone} />
              <Info label="Adres" value={`${profile.street} ${profile.house_number}${profile.apartment_number ? `/${profile.apartment_number}` : ''}, ${profile.zip_code} ${profile.city}`} />
            </div>
          </section>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
          >
            {status === 'loading' ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
          </button>
          <p className="text-center text-xs text-gray-400 pb-8">
            Po przesłaniu formularza skontaktujemy się z Tobą telefonicznie w celu potwierdzenia zapisu.
          </p>
        </form>
      </div>
    )
  }

  // ── Pełny formularz dla zalogowanego BEZ profilu (usunięte dane) lub niezalogowanego ──

  const selectedCourse = courses.find(c => String(c.id) === String(form.course))

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto mb-8">
        <a href={isLoggedIn ? '/konto' : '/'} className="text-sm text-gray-400 hover:text-red-600 transition-colors">
          ← {isLoggedIn ? 'Wróć do konta' : 'Wróć na stronę główną'}
        </a>
        <div className="flex items-center gap-3 mt-4 mb-1">
          <span className="text-2xl font-extrabold text-gray-900 tracking-tight">Mc Med</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mt-4 mb-1">Formularz zapisu</h1>
        <p className="text-gray-500 text-sm">
          {isLoggedIn
            ? 'Twoje poprzednie dane zostały usunięte — wypełnij formularz ponownie.'
            : 'Wypełnij poniższy formularz, aby zapisać się na kurs KPP.'}
        </p>
      </div>

      <form onSubmit={isLoggedIn ? handleFullLoggedInSubmit : handleSubmit} className="max-w-2xl mx-auto space-y-6">

        {/* Wybór kursu */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">Wybór kursu</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kurs *</label>
            <select
              name="course"
              value={form.course}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.course ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            >
              <option value="">— Wybierz kurs —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id} disabled={c.is_full}>
                  {c.name} | {formatDate(c.start_date)}
                  {c.is_full ? ' (brak miejsc)' : ` | ${c.spots_left} miejsc`}
                </option>
              ))}
            </select>
            {errors.course && <p className="text-red-500 text-xs mt-1">{errors.course}</p>}
          </div>

          {selectedCourse && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-100 text-sm text-gray-700 space-y-1">
              <div><span className="font-medium">Typ:</span> {selectedCourse.course_type_display}</div>
              <div><span className="font-medium">Termin:</span> {formatDate(selectedCourse.start_date)} – {formatDate(selectedCourse.end_date)}</div>
              <div><span className="font-medium">Miejsce:</span> {selectedCourse.city}</div>
              <div><span className="font-medium">Cena:</span> {selectedCourse.price} zł</div>
              <div><span className="font-medium">Wolne miejsca:</span> {selectedCourse.spots_left}</div>
            </div>
          )}
        </section>

        {/* Dane osobowe */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">Dane osobowe</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Imię" name="first_name" value={form.first_name} onChange={handleChange} error={errors.first_name} />
            <Field label="Nazwisko" name="last_name" value={form.last_name} onChange={handleChange} error={errors.last_name} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="PESEL" name="pesel" value={form.pesel} onChange={handleChange} error={errors.pesel} maxLength={11} inputMode="numeric" />
            <Field label="Data urodzenia" name="birth_date" value={form.birth_date} onChange={handleChange} error={errors.birth_date} type="date" />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {!isLoggedIn && <Field label="Adres email" name="email" value={form.email} onChange={handleChange} error={errors.email} type="email" placeholder="jan@example.pl" />}
            <Field label="Nr telefonu" name="phone" value={form.phone} onChange={handleChange} error={errors.phone} type="tel" placeholder="+48 000 000 000" className={isLoggedIn ? 'col-span-2' : ''} />
          </div>
        </section>

        {/* Adres */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">Adres zamieszkania</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Kod pocztowy" name="zip_code" value={form.zip_code} onChange={handleChange} error={errors.zip_code} placeholder="00-000" maxLength={6} />
            <div className="col-span-2">
              <Field label="Miejscowość" name="city" value={form.city} onChange={handleChange} error={errors.city} />
            </div>
          </div>
          <div className="mt-4">
            <Field label="Ulica" name="street" value={form.street} onChange={handleChange} error={errors.street} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="Nr domu" name="house_number" value={form.house_number} onChange={handleChange} error={errors.house_number} />
            <Field label="Nr mieszkania" name="apartment_number" value={form.apartment_number} onChange={handleChange} error={errors.apartment_number} required={false} />
          </div>
        </section>

        {/* Konto – tylko dla niezalogowanych */}
        {!isLoggedIn && <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-1">Utwórz konto</h2>

          {/* Info box */}
          <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
            <span className="text-red-500 text-lg flex-shrink-0 mt-0.5">🔑</span>
            <p className="text-sm text-gray-600 leading-relaxed">
              Po co konto? Otrzymasz tu wszelkie informacje związane z kursem
              oraz <span className="font-medium text-gray-800">materiały potrzebne do zajęć</span> –
              harmonogram, podręczniki i wyniki egzaminu, wszystko w jednym miejscu.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Hasło" name="password" value={form.password} onChange={handleChange} error={errors.password} type="password" placeholder="min. 8 znaków" />
            <Field label="Powtórz hasło" name="confirm_password" value={form.confirm_password} onChange={handleChange} error={errors.confirm_password} type="password" placeholder="••••••••" />
          </div>
        </section>}

        {/* Zgody */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">Zgody</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="data_consent"
              checked={form.data_consent}
              onChange={handleChange}
              className="mt-0.5 h-4 w-4 accent-red-600"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              Wyrażam zgodę na przetwarzanie moich danych osobowych przez Mc Med w celu realizacji kursu
              oraz kontaktu w sprawach z nim związanych, zgodnie z Rozporządzeniem RODO. *
            </span>
          </label>
          {errors.data_consent && <p className="text-red-500 text-xs mt-1 ml-7">{errors.data_consent}</p>}
          <label className="flex items-start gap-3 cursor-pointer mt-4">
            <input
              type="checkbox"
              name="photo_consent"
              checked={form.photo_consent}
              onChange={handleChange}
              className="mt-0.5 h-4 w-4 accent-red-600"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              Wyrażam zgodę na wykonywanie i publikowanie zdjęć i nagrań wideo z moim udziałem
              wykonanych podczas kursu w celach dokumentacyjnych i promocyjnych organizatora.
            </span>
          </label>
        </section>

        {serverError && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
        >
          {status === 'loading' ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
        </button>

        <p className="text-center text-xs text-gray-400 pb-8">
          Po przesłaniu formularza skontaktujemy się z Tobą telefonicznie w celu potwierdzenia zapisu.
        </p>
      </form>
    </div>
  )
}

function Info({ label, value, mono }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className={`font-medium text-gray-800 ${mono ? 'font-mono tracking-wide' : ''}`}>{value || '—'}</div>
    </div>
  )
}

function Field({ label, name, value, onChange, error, required = true, type = 'text', ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`}
        {...rest}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
