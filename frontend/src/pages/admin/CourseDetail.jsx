import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminFetchCourse, adminUpdateCourse, adminDeleteCourse, adminFetchEnrollments, adminDeleteEnrollment, adminUpdateEnrollment, adminAnonymizeEnrollment, adminSoftDeleteEnrollment, adminFetchCourses, adminDownloadDocument, adminDownloadDocumentPdf, adminDownloadXlsx, adminFetchInstructors, adminSendEmail, adminSendSms, adminCreateEnrollment, adminDownloadCertificate } from '../../api/admin'
import DeletionReasonModal from '../../components/DeletionReasonModal'
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
    exam_time: initial.exam_time ? initial.exam_time.slice(0, 5) : '',
    instructor_ids: (initial.instructors || []).map(i => i.id),
  })
  const [errors, setErrors]       = useState({})
  const [status, setStatus]       = useState('idle')
  const [allInstructors, setAllInstructors] = useState([])

  useEffect(() => {
    adminFetchInstructors().then(setAllInstructors).catch(() => {})
  }, [])

  const isRecert = form.course_type === 'recert'

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
      course_days: isRecert ? [] : form.course_days.filter(d => d),
      instructor_ids: isRecert ? [] : form.instructor_ids.filter(Boolean),
    }
    try {
      await adminUpdateCourse(initial.id, payload)
      const fresh = await adminFetchCourse(initial.id)
      setForm({ ...fresh, instructor_ids: (fresh.instructors || []).map(i => i.id) })
      setStatus('saved')
      onSaved && onSaved(fresh)
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Data utworzenia</label>
            <input type="date" name="created_at" value={form.created_at || ''} onChange={handleChange} className="field-input" />
          </div>
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
        {!isRecert && (
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
        )}
        <div className="grid grid-cols-3 gap-4">
          <Field label="Data egzaminu" name="exam_date" value={form.exam_date || ''} onChange={handleChange} type="date" required={false} />
          <Field label="Godzina egzaminu" name="exam_time" value={form.exam_time || ''} onChange={handleChange} type="time" step="60" required={false} />
          <Field label="Miejsce egzaminu (kod pocztowy, adres)" name="exam_location" value={form.exam_location} onChange={handleChange} required={false} placeholder="np. 30-001 Kraków, ul. Medyczna 5" />
          <Field label="Link do grupy WhatsApp" name="whatsapp_link" value={form.whatsapp_link || ''} onChange={handleChange} required={false} placeholder="https://chat.whatsapp.com/..." />
        </div>
      </Section>

      {!isRecert && (
        <Section title="Organizacja kursu">
          <InstSelect label="Kierownik podmiotu" name="entity_director" value={form.entity_director} onChange={handleChange} instructors={allInstructors} />
          <InstSelect label="Kierownik merytoryczny kursu" name="academic_director" value={form.academic_director} onChange={handleChange} instructors={allInstructors} />
        </Section>
      )}

      {!isRecert && (
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
      )}

      <Section title={isRecert ? 'Komisja egzaminacyjna' : 'Komisja egzaminacyjna i psycholog'}>
        {!isRecert && (
          <InstSelect label="Psycholog" name="psychologist" value={form.psychologist} onChange={handleChange} instructors={allInstructors} required={false} nameOnly />
        )}
        <div className={!isRecert ? 'border-t border-gray-100 pt-4 mt-2' : ''}>
          {!isRecert && (
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Skład komisji egzaminacyjnej</p>
          )}
          <InstSelect label="Przewodniczący komisji" name="committee_chair" value={form.committee_chair} onChange={handleChange} instructors={allInstructors} required={false} />
          <InstSelect label="Członek komisji 1" name="committee_member1" value={form.committee_member1} onChange={handleChange} instructors={allInstructors} required={false} />
          <InstSelect label="Członek komisji 2" name="committee_member2" value={form.committee_member2} onChange={handleChange} instructors={allInstructors} required={false} />
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
    'Nr certyfikatu', 'Data wydania certyfikatu',
    'Zaliczka', 'Zgoda na zdjęcia', 'Data zapisu',
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
    e.cert_number || '',
    formatDate(e.cert_date),
    e.deposit_paid ? 'Tak' : 'Nie',
    e.photo_consent ? 'Tak' : 'Nie',
    formatDateTime(e.created_at),
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 4 }, { wch: 18 }, { wch: 15 }, { wch: 13 }, { wch: 14 },
    { wch: 26 }, { wch: 13 },
    { wch: 22 }, { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 16 },
    { wch: 18 }, { wch: 22 },
    { wch: 10 }, { wch: 16 }, { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Uczestnicy')

  const slug = (courseName || 'kurs').replace(/\s+/g, '_').replace(/[^\w_-]/g, '').slice(0, 40)
  XLSX.writeFile(wb, `uczestnicy_${slug}.xlsx`)
}

// ─── Zakładka: Uczestnicy ─────────────────────────────────────────────

function EditEnrollmentModal({ enrollment, onSave, onClose }) {
  const [form, setForm] = useState({
    first_name: enrollment.first_name,
    last_name: enrollment.last_name,
    pesel: enrollment.pesel,
    birth_date: enrollment.birth_date,
    email: enrollment.email,
    phone: enrollment.phone,
    zip_code: enrollment.zip_code,
    city: enrollment.city,
    street: enrollment.street,
    house_number: enrollment.house_number,
    apartment_number: enrollment.apartment_number || '',
    cert_number: enrollment.cert_number || '',
    cert_date: enrollment.cert_date || '',
    photo_consent: enrollment.photo_consent,
    deposit_paid: enrollment.deposit_paid,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await adminUpdateEnrollment(enrollment.id, form)
      onSave(res.data)
    } catch {
      setError('Błąd zapisu. Sprawdź dane.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Edytuj dane uczestnika</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Imię <span className="text-red-500">*</span></label>
              <input name="first_name" value={form.first_name} onChange={set} className="field-input" required />
            </div>
            <div>
              <label className="field-label">Nazwisko <span className="text-red-500">*</span></label>
              <input name="last_name" value={form.last_name} onChange={set} className="field-input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">PESEL <span className="text-red-500">*</span></label>
              <input name="pesel" value={form.pesel} onChange={set} className="field-input font-mono" maxLength={11} required />
            </div>
            <div>
              <label className="field-label">Data urodzenia <span className="text-red-500">*</span></label>
              <input type="date" name="birth_date" value={form.birth_date} onChange={set} className="field-input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">E-mail</label>
              <input type="email" name="email" value={form.email} onChange={set} className="field-input" />
            </div>
            <div>
              <label className="field-label">Telefon</label>
              <input name="phone" value={form.phone} onChange={set} className="field-input" />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Adres</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="field-label">Kod pocztowy <span className="text-red-500">*</span></label>
                <input name="zip_code" value={form.zip_code} onChange={set} className="field-input" required />
              </div>
              <div className="col-span-2">
                <label className="field-label">Miejscowość <span className="text-red-500">*</span></label>
                <input name="city" value={form.city} onChange={set} className="field-input" required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="field-label">Ulica <span className="text-red-500">*</span></label>
                <input name="street" value={form.street} onChange={set} className="field-input" required />
              </div>
              <div>
                <label className="field-label">Nr domu <span className="text-red-500">*</span></label>
                <input name="house_number" value={form.house_number} onChange={set} className="field-input" required />
              </div>
              <div>
                <label className="field-label">Nr mieszk.</label>
                <input name="apartment_number" value={form.apartment_number} onChange={set} className="field-input" />
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Certyfikat (recertyfikacja)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Numer certyfikatu</label>
                <input name="cert_number" value={form.cert_number} onChange={set} className="field-input" placeholder="np. KPP/2021/00123" />
              </div>
              <div>
                <label className="field-label">Data wydania certyfikatu</label>
                <input type="date" name="cert_date" value={form.cert_date} onChange={set} className="field-input" />
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 flex items-center gap-8">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" name="photo_consent" checked={form.photo_consent} onChange={set} className="h-4 w-4 accent-red-600 rounded" />
              <span className="text-sm text-gray-700">Zgoda na zdjęcia</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" name="deposit_paid" checked={form.deposit_paid} onChange={set} className="h-4 w-4 accent-emerald-600 rounded" />
              <span className="text-sm text-gray-700">Wpłacono zaliczkę</span>
            </label>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-7 py-2.5 rounded-xl text-sm transition-colors">
              {saving ? 'Zapisywanie…' : 'Zapisz zmiany'}
            </button>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800 px-4 py-2.5 text-sm font-medium">Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TransferModal({ enrollment, courses, currentCourseId, onTransfer, onClose }) {
  const [targetId, setTargetId] = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')

  const available = (courses || []).filter(c => String(c.id) !== String(currentCourseId))

  async function handleTransfer() {
    if (!targetId) return
    setBusy(true)
    setError('')
    try {
      await adminUpdateEnrollment(enrollment.id, { course: parseInt(targetId) })
      onTransfer(enrollment.id)
    } catch {
      setError('Nie udało się przenieść. Kurs może być pełny.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Przenieś uczestnika</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Przenosisz: <span className="font-semibold text-gray-900">{enrollment.last_name} {enrollment.first_name}</span>
        </p>
        <label className="field-label">Kurs docelowy <span className="text-red-500">*</span></label>
        {courses === null ? (
          <p className="text-sm text-gray-400 my-3">Ładowanie kursów…</p>
        ) : (
          <select value={targetId} onChange={e => setTargetId(e.target.value)} className="field-input mb-4">
            <option value="">— wybierz kurs —</option>
            {available.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.city} ({formatDate(c.start_date)})
                {c.spots_left <= 0 ? ' — PEŁNY' : ` · ${c.spots_left} miejsc`}
              </option>
            ))}
          </select>
        )}
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={handleTransfer} disabled={!targetId || busy || courses === null}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
            {busy ? 'Przenoszenie…' : 'Przenieś'}
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 px-4 py-2.5 text-sm font-medium">Anuluj</button>
        </div>
      </div>
    </div>
  )
}

function AddParticipantModal({ courseId, onSave, onClose }) {
  const [form, setForm] = useState({
    course: courseId,
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
    cert_number: '',
    cert_date: '',
    deposit_paid: false,
    photo_consent: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await adminCreateEnrollment(form)
      onSave(res.data)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const msgs = Object.values(data).flat().join(' ')
        setError(msgs || 'Błąd zapisu.')
      } else {
        setError('Błąd zapisu. Sprawdź dane.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Dodaj uczestnika</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Imię</label>
              <input name="first_name" value={form.first_name} onChange={set} className="field-input" />
            </div>
            <div>
              <label className="field-label">Nazwisko</label>
              <input name="last_name" value={form.last_name} onChange={set} className="field-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">PESEL</label>
              <input name="pesel" value={form.pesel} onChange={set} className="field-input font-mono" maxLength={11} />
            </div>
            <div>
              <label className="field-label">Data urodzenia</label>
              <input type="date" name="birth_date" value={form.birth_date} onChange={set} className="field-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">E-mail</label>
              <input type="email" name="email" value={form.email} onChange={set} className="field-input" />
            </div>
            <div>
              <label className="field-label">Telefon</label>
              <input name="phone" value={form.phone} onChange={set} className="field-input" />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Adres</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="field-label">Kod pocztowy</label>
                <input name="zip_code" value={form.zip_code} onChange={set} className="field-input" />
              </div>
              <div className="col-span-2">
                <label className="field-label">Miejscowość</label>
                <input name="city" value={form.city} onChange={set} className="field-input" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="field-label">Ulica</label>
                <input name="street" value={form.street} onChange={set} className="field-input" />
              </div>
              <div>
                <label className="field-label">Nr domu</label>
                <input name="house_number" value={form.house_number} onChange={set} className="field-input" />
              </div>
              <div>
                <label className="field-label">Nr mieszk.</label>
                <input name="apartment_number" value={form.apartment_number} onChange={set} className="field-input" />
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Certyfikat (recertyfikacja)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Numer certyfikatu</label>
                <input name="cert_number" value={form.cert_number} onChange={set} className="field-input" placeholder="np. KPP/2021/00123" />
              </div>
              <div>
                <label className="field-label">Data wydania certyfikatu</label>
                <input type="date" name="cert_date" value={form.cert_date} onChange={set} className="field-input" />
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 flex items-center gap-8">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" name="deposit_paid" checked={form.deposit_paid} onChange={set} className="h-4 w-4 accent-emerald-600 rounded" />
              <span className="text-sm text-gray-700">Wpłacono zaliczkę</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" name="photo_consent" checked={form.photo_consent} onChange={set} className="h-4 w-4 accent-red-600 rounded" />
              <span className="text-sm text-gray-700">Zgoda na zdjęcia</span>
            </label>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-7 py-2.5 rounded-xl text-sm transition-colors">
              {saving ? 'Dodawanie…' : 'Dodaj uczestnika'}
            </button>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800 px-4 py-2.5 text-sm font-medium">Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EnrollmentTable({ courseId, courseName, examDate }) {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading]         = useState(true)

  // email mode
  const [emailMode, setEmailMode]   = useState(false)
  const [selected, setSelected]     = useState(new Set())
  const [subject, setSubject]       = useState('')
  const [body, setBody]             = useState('')
  const [sending, setSending]       = useState(false)
  const [sendResult, setSendResult] = useState(null)

  // sms mode
  const [smsMode, setSmsMode]         = useState(false)
  const [smsMessage, setSmsMessage]   = useState('')
  const [smsSending, setSmsSending]   = useState(false)
  const [smsSendResult, setSmsSendResult] = useState(null)

  // inline actions
  const [confirm, setConfirm]             = useState(null) // { type: 'remove'|'delete', id }
  const [processingId, setProcessingId]   = useState(null)
  const [togglingDeposit, setTogglingDeposit] = useState(null)
  const [downloadingCert, setDownloadingCert] = useState(null)

  // modals
  const [editingEnrollment, setEditingEnrollment]   = useState(null)
  const [transferEnrollment, setTransferEnrollment] = useState(null)
  const [allCourses, setAllCourses]                 = useState(null)
  const [deletionModal, setDeletionModal]           = useState(null) // enrollment object
  const [addingParticipant, setAddingParticipant]   = useState(false)

  useEffect(() => {
    adminFetchEnrollments(courseId)
      .then(setEnrollments)
      .finally(() => setLoading(false))
  }, [courseId])

  async function handleToggleDeposit(enrollment) {
    if (togglingDeposit) return
    const newVal = !enrollment.deposit_paid
    setTogglingDeposit(enrollment.id)
    setEnrollments(prev => prev.map(e => e.id === enrollment.id ? { ...e, deposit_paid: newVal } : e))
    try {
      await adminUpdateEnrollment(enrollment.id, { deposit_paid: newVal })
    } catch {
      setEnrollments(prev => prev.map(e => e.id === enrollment.id ? { ...e, deposit_paid: !newVal } : e))
    } finally {
      setTogglingDeposit(null)
    }
  }

  async function handleDelete(id) {
    setProcessingId(id)
    try {
      await adminDeleteEnrollment(id)
      setEnrollments(prev => prev.filter(e => e.id !== id))
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    } finally {
      setProcessingId(null)
      setConfirm(null)
    }
  }

  async function handleRemoveFromCourse(id) {
    setProcessingId(id)
    try {
      await adminUpdateEnrollment(id, { course: null })
      setEnrollments(prev => prev.filter(e => e.id !== id))
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    } finally {
      setProcessingId(null)
      setConfirm(null)
    }
  }

  async function handleSoftDelete(id, reason) {
    setProcessingId(id)
    try {
      await adminSoftDeleteEnrollment(id, reason)
      setEnrollments(prev => prev.filter(e => e.id !== id))
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
      setDeletionModal(null)
      setConfirm(null)
    } finally {
      setProcessingId(null)
    }
  }

  async function handleAnonymize(id) {
    setProcessingId(id)
    try {
      const res = await adminAnonymizeEnrollment(id)
      setEnrollments(prev => prev.map(e => e.id === id ? res.data : e))
    } finally {
      setProcessingId(null)
      setConfirm(null)
    }
  }

  async function openTransfer(enrollment) {
    setTransferEnrollment(enrollment)
    if (allCourses === null) {
      try {
        const courses = await adminFetchCourses()
        setAllCourses(courses)
      } catch {
        setAllCourses([])
      }
    }
  }

  function toggleEmailMode() {
    setEmailMode(m => !m)
    setSmsMode(false)
    setSelected(new Set())
    setSendResult(null)
  }

  function toggleSmsMode() {
    setSmsMode(m => !m)
    setEmailMode(false)
    setSelected(new Set())
    setSmsSendResult(null)
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function selectAll()   { setSelected(new Set(enrollments.map(e => e.id))) }
  function deselectAll() { setSelected(new Set()) }

  async function handleSend() {
    if (!subject.trim() || !body.trim() || selected.size === 0) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await adminSendEmail([...selected], subject, body)
      setSendResult(res.data)
    } catch {
      setSendResult({ error: true })
    } finally {
      setSending(false)
    }
  }

  async function handleSendSms() {
    if (!smsMessage.trim() || selected.size === 0) return
    setSmsSending(true)
    setSmsSendResult(null)
    try {
      const res = await adminSendSms([...selected], smsMessage)
      setSmsSendResult(res.data)
    } catch {
      setSmsSendResult({ error: true })
    } finally {
      setSmsSending(false)
    }
  }

  if (loading) return <div className="p-12 text-center text-gray-400 text-sm">Ładowanie…</div>

  const count = enrollments.length
  const suffix = count === 1 ? '' : count < 5 ? 'ów' : 'ów'

  return (
    <div className="mt-6">
      {addingParticipant && (
        <AddParticipantModal
          courseId={parseInt(courseId)}
          onSave={created => {
            setEnrollments(prev => [created, ...prev])
            setAddingParticipant(false)
          }}
          onClose={() => setAddingParticipant(false)}
        />
      )}
      {editingEnrollment && (
        <EditEnrollmentModal
          enrollment={editingEnrollment}
          onSave={updated => {
            setEnrollments(prev => prev.map(e => e.id === updated.id ? updated : e))
            setEditingEnrollment(null)
          }}
          onClose={() => setEditingEnrollment(null)}
        />
      )}
      {transferEnrollment && (
        <TransferModal
          enrollment={transferEnrollment}
          courses={allCourses}
          currentCourseId={courseId}
          onTransfer={id => {
            setEnrollments(prev => prev.filter(e => e.id !== id))
            setTransferEnrollment(null)
          }}
          onClose={() => setTransferEnrollment(null)}
        />
      )}
      {deletionModal && (
        <DeletionReasonModal
          participantName={`${deletionModal.last_name} ${deletionModal.first_name}`}
          onConfirm={reason => handleSoftDelete(deletionModal.id, reason)}
          onClose={() => setDeletionModal(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{count} uczestnik{suffix}</p>
        <div className="flex gap-2">
          <button
            onClick={() => exportToExcel(enrollments, courseName)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 px-4 py-2 rounded-lg transition-colors"
          >
            <span>↓</span> Pobierz listę (.xlsx)
          </button>
          <button
            onClick={toggleEmailMode}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              emailMode
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {emailMode ? 'Anuluj' : '✉ Wyślij maila'}
          </button>
          <button
            onClick={toggleSmsMode}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
              smsMode
                ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {smsMode ? 'Anuluj' : '📱 Wyślij SMS'}
          </button>
          <button
            onClick={() => setAddingParticipant(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 px-4 py-2 rounded-lg transition-colors"
          >
            + Dodaj uczestnika
          </button>
        </div>
      </div>

      {/* Panel SMS */}
      {smsMode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-900">
              Wybrano: <span className="text-emerald-700">{selected.size}</span> z {count}
            </p>
            <div className="flex gap-3 text-xs text-emerald-700">
              <button onClick={selectAll} className="hover:underline font-medium">Zaznacz wszystkich</button>
              <button onClick={deselectAll} className="hover:underline">Odznacz wszystkich</button>
            </div>
          </div>
          <div className="relative">
            <textarea
              placeholder="Treść SMS *"
              value={smsMessage}
              onChange={e => setSmsMessage(e.target.value)}
              maxLength={160}
              rows={4}
              className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white resize-none"
            />
            <span className={`absolute bottom-2 right-3 text-xs ${smsMessage.length > 140 ? 'text-orange-500' : 'text-gray-400'}`}>
              {smsMessage.length}/160
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSendSms}
                disabled={smsSending || selected.size === 0 || !smsMessage.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {smsSending ? 'Wysyłanie…' : `Wyślij do wybranych (${selected.size})`}
              </button>
              {smsSendResult && !smsSendResult.error && (
                <span className="text-sm text-green-700 font-medium">
                  Wysłano: {smsSendResult.sent}
                  {smsSendResult.failed?.length > 0 && `, błędy: ${smsSendResult.failed.length}`}
                </span>
              )}
              {smsSendResult?.error && (
                <span className="text-sm text-red-600">Błąd wysyłki SMS.</span>
              )}
            </div>
            {smsSendResult?.failed?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
                {smsSendResult.failed.map((f, i) => (
                  <p key={i} className="text-xs text-red-700">
                    <span className="font-semibold">{f.name || `#${f.id}`}:</span> {f.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel email */}
      {emailMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-900">
              Wybrano: <span className="text-blue-700">{selected.size}</span> z {count}
            </p>
            <div className="flex gap-3 text-xs text-blue-700">
              <button onClick={selectAll} className="hover:underline font-medium">Zaznacz wszystkich</button>
              <button onClick={deselectAll} className="hover:underline">Odznacz wszystkich</button>
            </div>
          </div>
          <input
            type="text"
            placeholder="Temat wiadomości *"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          <textarea
            placeholder="Treść wiadomości *"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-y"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSend}
              disabled={sending || selected.size === 0 || !subject.trim() || !body.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {sending ? 'Wysyłanie…' : `Wyślij do wybranych (${selected.size})`}
            </button>
            {sendResult && !sendResult.error && (
              <span className="text-sm text-green-700 font-medium">
                Wysłano: {sendResult.sent}
                {sendResult.failed?.length > 0 && `, błędy: ${sendResult.failed.length}`}
              </span>
            )}
            {sendResult?.error && (
              <span className="text-sm text-red-600">Błąd wysyłki. Sprawdź konfigurację e-mail.</span>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      {enrollments.length === 0 ? (
        <div className="p-12 text-center text-gray-400 text-sm">Brak zapisanych uczestników na ten kurs.</div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {(emailMode || smsMode) && <th className="px-4 py-3.5 w-10"></th>}
              <th className="px-4 py-3.5 font-semibold text-gray-600 w-10">Lp.</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Uczestnik</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">PESEL</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Data ur.</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Data egzaminu</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Kontakt</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Adres</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Certyfikat</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Zaliczka</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Zgoda foto</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600">Zapisano</th>
              <th className="px-5 py-3.5 font-semibold text-gray-600 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enrollments.map((e, idx) => (
              <tr
                key={e.id}
                className={`hover:bg-gray-50 transition-colors ${(emailMode || smsMode) && selected.has(e.id) ? emailMode ? 'bg-blue-50 hover:bg-blue-50' : 'bg-emerald-50 hover:bg-emerald-50' : ''}`}
                onClick={(emailMode || smsMode) ? () => toggleSelect(e.id) : undefined}
                style={(emailMode || smsMode) ? { cursor: 'pointer' } : undefined}
              >
                {(emailMode || smsMode) && (
                  <td className="px-4 py-4" onClick={ev => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggleSelect(e.id)}
                      className={`h-4 w-4 rounded ${emailMode ? 'accent-blue-600' : 'accent-emerald-600'}`}
                    />
                  </td>
                )}
                <td className="px-4 py-4 text-gray-400 text-sm tabular-nums">{idx + 1}</td>
                <td className="px-5 py-4 font-medium text-gray-900">{e.last_name} {e.first_name}</td>
                <td className="px-5 py-4 text-gray-600 font-mono tracking-wide">{e.pesel || <span className="text-gray-300 italic">usunięto</span>}</td>
                <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{e.birth_date ? formatDate(e.birth_date) : <span className="text-gray-300 italic">usunięto</span>}</td>
                <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{examDate ? formatDate(examDate) : <span className="text-gray-300 italic">—</span>}</td>
                <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                  <div>{e.email}</div>
                  <div>{e.phone || <span className="text-gray-300 italic">usunięto</span>}</div>
                </td>
                <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                  <div>{e.street} {e.house_number}{e.apartment_number ? `/${e.apartment_number}` : ''}</div>
                  <div>{e.zip_code} {e.city}</div>
                </td>
                <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                  {e.cert_number || e.cert_date ? (
                    <>
                      {e.cert_number && <div className="font-mono">{e.cert_number}</div>}
                      {e.cert_date && <div className="text-gray-400">{formatDate(e.cert_date)}</div>}
                    </>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={ev => { ev.stopPropagation(); if (!emailMode) handleToggleDeposit(e) }}
                    disabled={togglingDeposit === e.id || emailMode}
                    title={emailMode ? '' : 'Kliknij, aby zmienić'}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity ${
                      togglingDeposit === e.id ? 'opacity-40 cursor-wait' : emailMode ? '' : 'hover:opacity-70 cursor-pointer'
                    } ${e.deposit_paid ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-600'}`}
                  >
                    {e.deposit_paid ? 'Wpłacono' : 'Brak'}
                  </button>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.photo_consent ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {e.photo_consent ? 'Tak' : 'Nie'}
                  </span>
                </td>
                <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                <td className="px-4 py-4 text-right">
                  {!emailMode && !smsMode && (
                    confirm?.id === e.id ? (
                      confirm.type === 'anonymize' ? (
                        <div className="text-right">
                          <p className="text-xs text-gray-600 mb-2 max-w-[260px] ml-auto leading-relaxed">
                            Czy usunąć wszystkie dane wrażliwe użytkownika? Dane zostaną usunięte trwale.
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleAnonymize(e.id)}
                              disabled={processingId === e.id}
                              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {processingId === e.id ? '…' : 'Tak, usuń dane'}
                            </button>
                            <button onClick={() => setConfirm(null)} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Anuluj</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end whitespace-nowrap">
                          <span className="text-xs text-gray-500">
                            {confirm.type === 'softdelete' ? 'Usunąć uczestnika?' : 'Usunąć z kursu?'}
                          </span>
                          <button
                            onClick={() => confirm.type === 'softdelete' ? handleSoftDelete(e.id, '') : handleRemoveFromCourse(e.id)}
                            disabled={processingId === e.id}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {processingId === e.id ? '…' : 'Tak'}
                          </button>
                          <button onClick={() => setConfirm(null)} className="text-xs text-gray-400 hover:text-gray-600">Nie</button>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex gap-1.5">
                          <button onClick={() => setEditingEnrollment(e)} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">Edytuj</button>
                          <button onClick={() => openTransfer(e)} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">Przenieś</button>
                          <button
                            onClick={async () => {
                              setDownloadingCert(e.id)
                              try { await adminDownloadCertificate(e.id, e.last_name, e.first_name) }
                              catch { alert('Błąd pobierania certyfikatu. Sprawdź czy plik certyfikat.docx istnieje w szablonach.') }
                              finally { setDownloadingCert(null) }
                            }}
                            disabled={downloadingCert === e.id}
                            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 transition-colors"
                          >
                            {downloadingCert === e.id ? '…' : 'Certyfikat'}
                          </button>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => setConfirm({ type: 'remove', id: e.id })} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Usuń z kursu</button>
                          <button
                            onClick={() => e.deposit_paid ? setDeletionModal(e) : setConfirm({ type: 'softdelete', id: e.id })}
                            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          >
                            Usuń uczestnika
                          </button>
                        </div>
                        {e.pesel && <button onClick={() => setConfirm({ type: 'anonymize', id: e.id })} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">Usuń dane wrażliwe</button>}
                      </div>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
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
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  useEffect(() => {
    adminFetchCourse(id)
      .then(setCourse)
      .catch(() => setError('Nie udało się pobrać kursu.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDeleteCourse() {
    setDeleting(true)
    try {
      await adminDeleteCourse(id)
      navigate('/admin/courses')
    } catch {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Ładowanie…</div>
  if (error)   return <div className="p-8 text-red-600 text-sm">{error}</div>

  return (
    <div className="p-8">
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
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${course.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {course.is_active ? 'Aktywny' : 'Nieaktywny'}
          </span>
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Na pewno usunąć kurs?</span>
              <button
                onClick={handleDeleteCourse}
                disabled={deleting}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Usuwanie…' : 'Tak, usuń'}
              </button>
              <button onClick={() => setDeleteConfirm(false)} className="text-xs text-gray-400 hover:text-gray-700">Anuluj</button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Usuń kurs
            </button>
          )}
        </div>
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

      {tab === 'dane' && <div className="max-w-4xl"><CourseForm initial={course} onSaved={setCourse} /></div>}
      {tab === 'uczestnicy' && <EnrollmentTable courseId={id} courseName={course.name} examDate={course.exam_date} />}
      {tab === 'dokumenty' && <div className="max-w-4xl"><DocumentsTab courseId={id} courseType={course.course_type} /></div>}
    </div>
  )
}

// ─── Zakładka: Dokumenty ──────────────────────────────────────────────

const DOCUMENTS_KPP = [
  { filename: 'oswiadczenie', label: 'Oświadczenie', description: '' },
  { filename: 'sprzet',       label: 'Sprzęt',       description: '' },
  { filename: 'sale',         label: 'Sale',          description: '' },
  { filename: 'wniosek',      label: 'Wniosek',       description: '' },
  { filename: 'prosba',       label: 'Prośba',        description: '' },
  { filename: 'instruktorzy', label: 'Instruktorzy',  description: '' },
]

const DOCUMENTS_RECERT = [
  { filename: 'prosba-recertyfikacja', label: 'Prośba o recertyfikację', description: '' },
  { filename: 'informacja-kpp',        label: 'Informacja KPP',          description: '' },
]

const XLSX_DOCUMENTS = [
  { filename: 'program', label: 'Program zajęć', description: '' },
]

function DocumentsTab({ courseId, courseType }) {
  const DOCUMENTS = courseType === 'recert' ? DOCUMENTS_RECERT : DOCUMENTS_KPP
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

  async function handleDownloadPdf(filename, label) {
    const key = `pdf_${filename}`
    setDownloading(key)
    setError('')
    try {
      await adminDownloadDocumentPdf(courseId, filename, label)
      setDownloaded(prev => new Set([...prev, key]))
    } catch {
      setError('Nie udało się pobrać dokumentu PDF. Upewnij się, że Microsoft Word jest zainstalowany na serwerze.')
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
        const isDoneDocx = downloaded.has(filename)
        const isDonePdf  = downloaded.has(`pdf_${filename}`)
        const isLoadingDocx = downloading === filename
        const isLoadingPdf  = downloading === `pdf_${filename}`
        return (
          <div key={filename} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload(filename, label)}
                disabled={isLoadingDocx || isLoadingPdf}
                className={`flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${
                  isDoneDocx ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                }`}
              >
                {isLoadingDocx ? 'Pobieranie…' : isDoneDocx ? '✓ .docx' : '↓ Pobierz .docx'}
              </button>
              <button
                onClick={() => handleDownloadPdf(filename, label)}
                disabled={isLoadingDocx || isLoadingPdf}
                className={`flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${
                  isDonePdf ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700 active:bg-gray-800'
                }`}
              >
                {isLoadingPdf ? 'Pobieranie…' : isDonePdf ? '✓ .pdf' : '↓ Pobierz .pdf'}
              </button>
            </div>
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

function InstSelect({ label, name, value, onChange, error, required = true, instructors = [], nameOnly = false }) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`field-input ${error ? 'border-red-400 bg-red-50' : ''}`}
      >
        <option value="">— wybierz —</option>
        {instructors.map(inst => {
          const val = nameOnly ? `${inst.first_name} ${inst.last_name}` : inst.full_name
          return (
            <option key={inst.id} value={val}>
              {inst.full_name}{inst.specializations.length > 0 ? ` (${inst.specializations.join(', ')})` : ''}
            </option>
          )
        })}
      </select>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
