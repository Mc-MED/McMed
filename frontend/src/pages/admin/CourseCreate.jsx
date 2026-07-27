import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminCreateCourse } from '../../api/admin'

const today = new Date().toISOString().slice(0, 10)

const DUMMY = {
  name: 'Kurs KPP – edycja lipcowa 2026',
  course_type: 'kpp',
  city: '30-001 Kraków, ul. Medyczna 5',
  max_participants: '12',
  price: '800',
  course_days: ['2026-07-07', '2026-07-08', '2026-07-09', '2026-07-14', '2026-07-15', '2026-07-16'],
  exam_date: '2026-07-16',
  exam_time: '10:00',
  exam_location: 'ul. Medyczna 5, Kraków',
  entity_director: 'dr Jan Wiśniewski',
  academic_director: 'mgr Anna Kowalska',
  instructors: ['Tomasz Nowak', 'Katarzyna Zielińska'],
  psychologist: 'mgr Piotr Malinowski',
  committee_chair: 'dr hab. Maria Wójcik',
  committee_member1: 'dr Krzysztof Dąbrowski',
  committee_member2: 'mgr Joanna Kamińska',
}

const EMPTY = {
  name: '',
  course_type: 'kpp',
  city: '',
  max_participants: '',
  price: '',
  course_days: ['', '', '', '', '', ''],
  exam_date: '',
  exam_time: '',
  exam_location: '',
  entity_director: '',
  academic_director: '',
  instructors: [''],
  psychologist: '',
  committee_chair: '',
  committee_member1: '',
  committee_member2: '',
}

export default function CourseCreate() {
  const navigate = useNavigate()
  const [form, setForm]     = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [serverMsg, setServerMsg] = useState('')

  const instructorsCount = useMemo(() => {
    const n = parseInt(form.max_participants, 10)
    return n > 0 ? Math.ceil(n / 6) : 1
  }, [form.max_participants])

  // Sync instructors array length with instructorsCount
  function syncInstructors(count, current) {
    if (current.length === count) return current
    if (current.length < count) return [...current, ...Array(count - current.length).fill('')]
    return current.slice(0, count)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setErrors(er => ({ ...er, [name]: '' }))

    if (name === 'max_participants') {
      const n = parseInt(value, 10)
      const count = n > 0 ? Math.ceil(n / 6) : 1
      setForm(f => ({
        ...f,
        max_participants: value,
        instructors: syncInstructors(count, f.instructors),
      }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  function handleDay(index, value) {
    setForm(f => {
      const days = [...f.course_days]
      days[index] = value
      return { ...f, course_days: days }
    })
    setErrors(er => ({ ...er, course_days: '' }))
  }

  function handleInstructor(index, value) {
    setForm(f => {
      const inst = [...f.instructors]
      inst[index] = value
      return { ...f, instructors: inst }
    })
  }

  function validate() {
    const e = {}
    if (!form.name.trim())           e.name           = 'Podaj tytuł kursu.'
    if (!form.city.trim())           e.city           = 'Podaj adres kursu.'
    if (!form.max_participants || parseInt(form.max_participants) < 1)
                                     e.max_participants = 'Podaj liczbę kursantów.'
    const filledDays = form.course_days.filter(d => d)
    if (filledDays.length !== 6)     e.course_days    = 'Uzupełnij wszystkie 6 dni kursu.'
    if (!form.exam_date)             e.exam_date      = 'Podaj datę egzaminu.'
    if (!form.exam_location.trim())  e.exam_location  = 'Podaj miejsce egzaminu.'
    if (!form.entity_director.trim()) e.entity_director = 'Podaj kierownika podmiotu.'
    if (!form.academic_director.trim()) e.academic_director = 'Podaj kierownika merytorycznego.'
    form.instructors.forEach((v, i) => {
      if (!v.trim()) e[`instructor_${i}`] = 'Podaj imię i nazwisko.'
    })
    if (!form.committee_chair.trim())   e.committee_chair   = 'Podaj przewodniczącego komisji.'
    if (!form.committee_member1.trim()) e.committee_member1 = 'Podaj pierwszego członka komisji.'
    if (!form.committee_member2.trim()) e.committee_member2 = 'Podaj drugiego członka komisji.'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setStatus('loading')
    setServerMsg('')

    const payload = {
      ...form,
      max_participants: parseInt(form.max_participants),
      price: parseFloat(form.price) || 0,
      course_days: form.course_days.filter(d => d),
    }

    try {
      await adminCreateCourse(payload)
      setStatus('success')
      setTimeout(() => navigate('/admin/courses'), 1200)
    } catch (err) {
      setStatus('error')
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const fieldErrors = {}
        for (const [key, val] of Object.entries(data)) {
          fieldErrors[key] = Array.isArray(val) ? val[0] : String(val)
        }
        setErrors(fieldErrors)
      } else {
        setServerMsg('Błąd serwera. Sprawdź czy jesteś zalogowany.')
      }
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/courses')}
          className="text-sm text-gray-400 hover:text-red-600 transition-colors mb-4 block"
        >
          ← Wróć do listy kursów
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Utwórz kurs</h1>
            <p className="text-gray-500 text-sm">Wypełnij dane nowego kursu KPP.</p>
          </div>
          <button
            type="button"
            onClick={() => { setForm(DUMMY); setErrors({}) }}
            className="text-xs text-gray-400 border border-gray-200 hover:border-red-300 hover:text-red-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Wstaw dane testowe
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Informacje ogólne ── */}
        <Section title="Informacje ogólne">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Data utworzenia</label>
              <input type="text" value={today} readOnly
                className="field-input bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="field-label">Typ kursu *</label>
              <select name="course_type" value={form.course_type} onChange={handleChange}
                className="field-input">
                <option value="kpp">Kwalifikowana Pierwsza Pomoc</option>
                <option value="recert">Recertyfikacja</option>
              </select>
            </div>
          </div>
          <Field label="Tytuł kursu" name="name" value={form.name}
            onChange={handleChange} error={errors.name} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Adres kursu" name="city" value={form.city}
              onChange={handleChange} error={errors.city}
              placeholder="np. 30-001 Kraków, ul. Medyczna 5" />
            <Field label="Liczba kursantów" name="max_participants" value={form.max_participants}
              onChange={handleChange} error={errors.max_participants} type="number" min="1" />
          </div>
          <Field label="Cena (zł)" name="price" value={form.price}
            onChange={handleChange} type="number" min="0" step="0.01" required={false} />
        </Section>

        {/* ── Terminy ── */}
        <Section title="Terminy">
          <div>
            <label className="field-label">Dni kursu * <span className="font-normal text-gray-400">(wybierz 6 dat)</span></label>
            <div className="grid grid-cols-3 gap-3">
              {form.course_days.map((d, i) => (
                <div key={i}>
                  <label className="text-xs text-gray-500 mb-1 block">Dzień {i + 1}</label>
                  <input
                    type="date"
                    value={d}
                    onChange={e => handleDay(i, e.target.value)}
                    className={`field-input ${errors.course_days ? 'border-red-400 bg-red-50' : ''}`}
                  />
                </div>
              ))}
            </div>
            {errors.course_days && <p className="text-red-500 text-xs mt-1">{errors.course_days}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Data egzaminu" name="exam_date" value={form.exam_date}
              onChange={handleChange} error={errors.exam_date} type="date" />
            <Field label="Godzina egzaminu" name="exam_time" value={form.exam_time}
              onChange={handleChange} error={errors.exam_time} type="time" />
            <Field label="Miejsce egzaminu" name="exam_location" value={form.exam_location}
              onChange={handleChange} error={errors.exam_location}
              placeholder="np. 30-001 Kraków, ul. Medyczna 5" />
          </div>
        </Section>

        {/* ── Organizacja ── */}
        <Section title="Organizacja kursu">
          <Field label="Kierownik podmiotu" name="entity_director" value={form.entity_director}
            onChange={handleChange} error={errors.entity_director} />
          <Field label="Kierownik merytoryczny kursu" name="academic_director" value={form.academic_director}
            onChange={handleChange} error={errors.academic_director} />
        </Section>

        {/* ── Prowadzący ── */}
        <Section
          title="Prowadzący"
          subtitle={`${instructorsCount} prowadzący${instructorsCount > 1 ? 'ch' : ''} (1 na każdych 6 kursantów)`}
        >
          {form.instructors.map((name, i) => (
            <Field
              key={i}
              label={`Prowadzący ${i + 1}`}
              name={`instructor_${i}`}
              value={name}
              onChange={e => handleInstructor(i, e.target.value)}
              error={errors[`instructor_${i}`]}
              placeholder="Imię i nazwisko"
            />
          ))}
        </Section>

        {/* ── Pozostała kadra i komisja ── */}
        <Section title="Komisja egzaminacyjna i psycholog">
          <Field label="Psycholog" name="psychologist" value={form.psychologist}
            onChange={handleChange} required={false} />
          <div className="border-t border-gray-100 pt-4 mt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Skład komisji egzaminacyjnej
            </p>
            <Field label="Przewodniczący komisji" name="committee_chair" value={form.committee_chair}
              onChange={handleChange} error={errors.committee_chair} placeholder="Imię i nazwisko" />
            <Field label="Członek komisji 1" name="committee_member1" value={form.committee_member1}
              onChange={handleChange} error={errors.committee_member1} placeholder="Imię i nazwisko" />
            <Field label="Członek komisji 2" name="committee_member2" value={form.committee_member2}
              onChange={handleChange} error={errors.committee_member2} placeholder="Imię i nazwisko" />
          </div>
        </Section>

        {serverMsg && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {serverMsg}
          </p>
        )}

        {status === 'success' && (
          <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            Kurs został utworzony. Przekierowuję…
          </p>
        )}

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => navigate('/admin/courses')}
            className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            Anuluj
          </button>
          <button type="submit" disabled={status === 'loading' || status === 'success'}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors">
            {status === 'loading' ? 'Zapisywanie…' : 'Utwórz kurs'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div className="mb-2">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, name, value, onChange, error, required = true, type = 'text', placeholder, ...rest }) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`field-input ${error ? 'border-red-400 bg-red-50' : ''}`}
        {...rest}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
