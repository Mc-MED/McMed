import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminFetchCourse, adminUpdateCourse, adminFetchEnrollments, adminDeleteEnrollment, adminDownloadDocument, adminDownloadXlsx, adminFetchInstructors } from '../../api/admin'
import * as XLSX from 'xlsx'

function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pl-PL') + ', ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

// ─── Zakładka: Dane kursu ─────────────────────────────────────────────

function CourseForm({ initial, onSaved }) {
  const [form, setForm]           = useState({
    ...initial,
    instructor_ids: (initial.instructors || []).map(i => i.id),
  })
  const [errors, setErrors]       = useState({})
  const [status, setStatus]       = useState('idle')
  const [allInstructors, setAllInstructors] = useState([])

  useEffect(() => {
    adminFetchInstructors().then(setAllInstructors).catch(() => {})
  }, [])

  const instructorsCount = useMemo(() => {
    const n = parseInt(form.max_participants, 10)
    return n > 0 ? Math.ceil(n / 6) : 1
  }, [form.max_participants])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setErrors(er => ({ ...er, [name]: '' }))
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleDay(i, value) {
    setForm(f => { const d = [...f.course_days]; d[i] = value; return { ...f, course_days: d } })
  }

  function handleInstructorSlot(index, value) {
    setForm(f => {
      const ids = [...f.instructor_ids]
      ids[index] = value ? parseInt(value) : null
      return { ...f, instructor_ids: ids }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrors({})
    const payload = {
      ...form,
      max_participants: parseInt(form.max_participants),
      price: parseFloat(form.price) || 0,
      course_days: form.course_days.filter(d => d),
      instructor_ids: form.instructor_ids.filter(Boolean),
    }
    try {
      const res = await adminUpdateCourse(initial.id, payload)
      setForm({ ...res.data, instructor_ids: (res.data.instructors || []).map(i => i.id) })
      setStatus('saved')
      onSaved && onSaved(res.data)
      setTimeout(() => setStatus('idle'), 2500)
    } catch (err) {
      setStatus('error')
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const fe = {}
        for (const [k, v] of Object.entries(data)) fe[k] = Array.isArray(v) ? v[0] : String(v)
        setErrors(fe)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-6">

      <Section title="Informacje ogólne">
        <div className="text-xs text-gray-400">
          Utworzono: <span className="font-medium text-gray-500">{formatDateTime(form.created_at)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Typ kursu</label>
            <select name="course_type" value={form.course_type} onChange={handleChange} className="field-input">
              <option value="kpp">Kwalifikowana Pierwsza Pomoc</option>
              <option value="recert">Recertyfikacja</option>
            </select>
          </div>
          <div>
            <label className="field-label">Status</label>
            <select name="is_active" value={String(form.is_active)} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))} className="field-input">
              <option value="true">Aktywny</option>
              <option value="false">Nieaktywny</option>
            </select>
          </div>
        </div>
        <Field label="Tytuł kursu" name="name" value={form.name} onChange={handleChange} error={errors.name} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Adres kursu" name="city" value={form.city} onChange={handleChange} error={errors.city} placeholder="np. 30-001 Kraków, ul. Medyczna 5" />
          <Field label="Liczba kursantów" name="max_participants" value={form.max_participants} onChange={handleChange} error={errors.max_participants} type="number" min="1" />
        </div>
        <Field label="Cena (zł)" name="price" value={form.price} onChange={handleChange} type="number" min="0" step="0.01" required={false} />
      </Section>

      <Section title="Terminy">
        <div>
          <label className="field-label">Dni kursu <span className="font-normal text-gray-400">(6 dat)</span></label>
          <div className="grid grid-cols-3 gap-3">
            {(form.course_days.length < 6
              ? [...form.course_days, ...Array(6 - form.course_days.length).fill('')]
              : form.course_days
            ).map((d, i) => (
              <div key={i}>
                <label className="text-xs text-gray-500 mb-1 block">Dzień {i + 1}</label>
                <input type="date" value={d} onChange={e => handleDay(i, e.target.value)}
                  className={`field-input ${errors.course_days ? 'border-red-400 bg-red-50' : ''}`} />
              </div>
            ))}
          </div>
          {errors.course_days && <p className="text-red-500 text-xs mt-1">{errors.course_days}</p>}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Data egzaminu" name="exam_date" value={form.exam_date || ''} onChange={handleChange} type="date" required={false} />
          <Field label="Godzina egzaminu" name="exam_time" value={form.exam_time || ''} onChange={handleChange} type="time" required={false} />
          <Field label="Miejsce egzaminu" name="exam_location" value={form.exam_location} onChange={handleChange} required={false} placeholder="np. 30-001 Kraków, ul. Medyczna 5" />
        </div>
      </Section>

      <Section title="Organizacja kursu">
        <Field label="Kierownik podmiotu" name="entity_director" value={form.entity_director} onChange={handleChange} required={false} />
        <Field label="Kierownik merytoryczny kursu" name="academic_director" value={form.academic_director} onChange={handleChange} required={false} />
      </Section>

      <Section
        title="Prowadzący"
        subtitle={`${instructorsCount} prowadzący${instructorsCount > 1 ? 'ch' : ''} (1 na każdych 6 kursantów)`}
      >
        {allInstructors.length === 0 ? (
          <p className="text-sm text-gray-400">Brak ratowników w bazie.</p>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: instructorsCount }, (_, i) => (
              <div key={i}>
                <label className="field-label">Prowadzący {i + 1}</label>
                <select
                  value={form.instructor_ids[i] ?? ''}
                  onChange={e => handleInstructorSlot(i, e.target.value)}
                  className="field-input"
                >
                  <option value="">— wybierz ratownika —</option>
                  {allInstructors.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.full_name}{inst.specializations.length > 0 ? ` (${inst.specializations.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Komisja egzaminacyjna i psycholog">
        <Field label="Psycholog" name="psychologist" value={form.psychologist} onChange={handleChange} required={false} />
        <div className="border-t border-gray-100 pt-4 mt-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Skład komisji egzaminacyjnej</p>
          <Field label="Przewodniczący komisji" name="committee_chair" value={form.committee_chair} onChange={handleChange} placeholder="Imię i nazwisko" required={false} />
          <Field label="Członek komisji 1" name="committee_member1" value={form.committee_member1} onChange={handleChange} placeholder="Imię i nazwisko" required={false} />
          <Field label="Członek komisji 2" name="committee_member2" value={form.committee_member2} onChange={handleChange} placeholder="Imię i nazwisko" required={false} />
        </div>
      </Section>

      <div className="flex items-center gap-4 pb-8">
        <button type="submit" disabled={status === 'loading'}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-8 py-3 rounded-xl text-sm transition-colors">
          {status === 'loading' ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </button>
        {status === 'saved' && <span className="text-green-600 text-sm font-medium">Zapisano.</span>}
        {status === 'error' && <span className="text-red-600 text-sm">Błąd zapisu. Sprawdź pola.</span>}
      </div>
    </form>
  )
}

// ─── Excel export ─────────────────────────────────────────────────────

function exportToExcel(enrollments, courseName) {
  const headers = [
    'Lp.', 'Nazwisko', 'Imię', 'PESEL', 'Data urodzenia',
    'Email', 'Telefon',
    'Ulica', 'Nr domu', 'Nr mieszkania', 'Kod pocztowy', 'Miejscowość',
    'Zgoda na zdjęcia', 'Data zapisu',
  ]
  const rows = enrollments.map((e, i) => [
    i + 1,
    e.last_name,
    e.first_name,
    String(e.pesel),
    formatDate(e.birth_date),
    e.email,
    e.phone,
    e.street,
    e.house_number,
    e.apartment_number || '',
    e.zip_code,
    e.city,
    e.photo_consent ? 'Tak' : 'Nie',
    formatDateTime(e.created_at),
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 4 }, { wch: 18 }, { wch: 15 }, { wch: 13 }, { wch: 14 },
    { wch: 26 }, { wch: 13 },
    { wch: 22 }, { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 16 },
    { wch: 16 }, { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Uczestnicy')

  const slug = (courseName || 'kurs').replace(/\s+/g, '_').replace(/[^\w_-]/g, '').slice(0, 40)
  XLSX.writeFile(wb, `uczestnicy_${slug}.xlsx`)
}

// ─── Zakładka: Uczestnicy ─────────────────────────────────────────────

function EnrollmentTable({ courseId, courseName }) {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [deletingId, setDeletingId]   = useState(null)
  const [confirmId, setConfirmId]     = useState(null)

  useEffect(() => {
    adminFetchEnrollments(courseId)
      .then(setEnrollments)
      .finally(() => setLoading(false))
  }, [courseId])

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await adminDeleteEnrollment(id)
      setEnrollments(prev => prev.filter(e => e.id !== id))
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  if (loading) return <div className="p-12 text-center text-gray-400 text-sm">Ładowanie…</div>

  if (enrollments.length === 0)
    return <div className="p-12 text-center text-gray-400 text-sm">Brak zapisanych uczestników na ten kurs.</div>

  const count = enrollments.length
  const suffix = count === 1 ? '' : count < 5 ? 'ów' : 'ów'

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{count} uczestnik{suffix}</p>
        <button
          onClick={() => exportToExcel(enrollments, courseName)}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 px-4 py-2 rounded-lg transition-colors"
        >
          <span>↓</span> Pobierz listę (.xlsx)
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-5 py-3.5 font-semibold text-gray-600">Uczestnik</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">PESEL</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Data ur.</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Kontakt</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Adres</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Zgoda foto</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Zapisano</th>
              <th className="px-5 py-3.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enrollments.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4 font-medium text-gray-900">{e.last_name} {e.first_name}</td>
                <td className="px-5 py-4 text-gray-600 font-mono tracking-wide">{e.pesel}</td>
                <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{formatDate(e.birth_date)}</td>
                <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                  <div>{e.email}</div>
                  <div>{e.phone}</div>
                </td>
                <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                  <div>{e.street} {e.house_number}{e.apartment_number ? `/${e.apartment_number}` : ''}</div>
                  <div>{e.zip_code} {e.city}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.photo_consent ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {e.photo_consent ? 'Tak' : 'Nie'}
                  </span>
                </td>
                <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                <td className="px-5 py-4 text-right">
                  {confirmId === e.id ? (
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-gray-500">Usunąć?</span>
                      <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                        {deletingId === e.id ? '…' : 'Tak'}
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs text-gray-400 hover:text-gray-600">Nie</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(e.id)}
                      className="text-xs text-gray-400 hover:text-red-600 transition-colors font-medium">
                      Usuń
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Główny widok ─────────────────────────────────────────────────────

export default function CourseDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [course, setCourse]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState('dane')

  useEffect(() => {
    adminFetchCourse(id)
      .then(setCourse)
      .catch(() => setError('Nie udało się pobrać kursu.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Ładowanie…</div>
  if (error)   return <div className="p-8 text-red-600 text-sm">{error}</div>

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => navigate('/admin/courses')}
        className="text-sm text-gray-400 hover:text-red-600 transition-colors mb-6 block">
        ← Wróć do listy kursów
      </button>

      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{course.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {course.city} · {formatDate(course.start_date)} – {formatDate(course.end_date)}
          </p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full mt-1 ${course.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {course.is_active ? 'Aktywny' : 'Nieaktywny'}
        </span>
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 border-b border-gray-200 mt-6">
        {[['dane', 'Dane kursu'], ['uczestnicy', `Uczestnicy (${course.max_participants - course.spots_left}/${course.max_participants})`], ['dokumenty', 'Dokumenty']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'dane' && <CourseForm initial={course} onSaved={setCourse} />}
      {tab === 'uczestnicy' && <EnrollmentTable courseId={id} courseName={course.name} />}
      {tab === 'dokumenty' && <DocumentsTab courseId={id} />}
    </div>
  )
}

// ─── Zakładka: Dokumenty ──────────────────────────────────────────────

const DOCUMENTS = [
  { filename: 'file1', label: 'File 1', description: '' },
  { filename: 'file2', label: 'File 2', description: '' },
  { filename: 'file3', label: 'File 3', description: '' },
  { filename: 'file4', label: 'File 4', description: '' },
  { filename: 'file5', label: 'File 5', description: '' },
  { filename: 'file6', label: 'File 6', description: '' },
]

const XLSX_DOCUMENTS = [
  { filename: 'program', label: 'Program zajęć', description: '' },
]

function DocumentsTab({ courseId }) {
  const [downloading, setDownloading] = useState(null)
  const [downloaded, setDownloaded]   = useState(new Set())
  const [error, setError]             = useState('')

  async function handleDownload(filename, label) {
    setDownloading(filename)
    setError('')
    try {
      await adminDownloadDocument(courseId, filename, label)
      setDownloaded(prev => new Set([...prev, filename]))
    } catch {
      setError('Nie udało się pobrać dokumentu.')
    } finally {
      setDownloading(null)
    }
  }

  async function handleDownloadXlsx(filename, label) {
    setDownloading(`xlsx_${filename}`)
    setError('')
    try {
      await adminDownloadXlsx(courseId, filename, label)
      setDownloaded(prev => new Set([...prev, `xlsx_${filename}`]))
    } catch {
      setError('Nie udało się pobrać dokumentu.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {DOCUMENTS.map(({ filename, label, description }) => {
        const isDone = downloaded.has(filename)
        const isLoading = downloading === filename
        return (
          <div key={filename} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={() => handleDownload(filename, label)}
              disabled={isLoading}
              className={`flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${
                isDone ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
              }`}
            >
              {isLoading ? 'Pobieranie…' : isDone ? '✓ Pobrane' : '↓ Pobierz .docx'}
            </button>
          </div>
        )
      })}
      {XLSX_DOCUMENTS.map(({ filename, label, description }) => {
        const key = `xlsx_${filename}`
        const isDone = downloaded.has(key)
        const isLoading = downloading === key
        return (
          <div key={key} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={() => handleDownloadXlsx(filename, label)}
              disabled={isLoading}
              className={`flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${
                isDone ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
              }`}
            >
              {isLoading ? 'Pobieranie…' : isDone ? '✓ Pobrane' : '↓ Pobierz .xlsx'}
            </button>
          </div>
        )
      })}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────

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
      <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder}
        className={`field-input ${error ? 'border-red-400 bg-red-50' : ''}`} {...rest} />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
