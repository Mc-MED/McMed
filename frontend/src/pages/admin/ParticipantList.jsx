import { useEffect, useState } from 'react'
import { adminFetchEnrollments, adminFetchUnassignedEnrollments, adminFetchDeletedEnrollments, adminFetchCourses, adminDeleteEnrollment, adminUpdateEnrollment, adminAnonymizeEnrollment, adminSoftDeleteEnrollment, adminRestoreEnrollment, adminSendPasswordReset, adminGenerateResetLink } from '../../api/admin'
import DeletionReasonModal from '../../components/DeletionReasonModal'

function ResetLinkModal({ link, type, onClose }) {
  const isActivation = type === 'activation'
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-1">
          {isActivation ? 'Link aktywacyjny' : 'Link do resetu hasła'}
        </h2>
        {isActivation && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
            Konto uczestnika nie zostało jeszcze aktywowane – wygenerowano nowy link aktywacyjny.
          </p>
        )}
        <p className="text-xs text-gray-500 mb-4">
          Skopiuj ten link i wyślij uczestnikowi ręcznie. Link jest jednorazowy i wygasa po {isActivation ? '72' : '2'}&nbsp;h.
        </p>
        <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-4">
          <span className="text-xs text-gray-700 break-all flex-1 select-all font-mono">{link}</span>
          <button
            onClick={copy}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-colors"
          >
            {copied ? '✓ Skopiowano' : 'Kopiuj'}
          </button>
        </div>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 font-medium">Zamknij</button>
      </div>
    </div>
  )
}

function ResetPasswordDropdown({ id, email, resetState, onSendEmail, onGenerateLink }) {
  const [open, setOpen] = useState(false)
  const state = resetState[id]

  if (state === 'sent-reset') return <span className="text-xs font-semibold px-2.5 py-1 text-emerald-600">✓ Wysłano reset hasła</span>
  if (state === 'sent-activation') return <span className="text-xs font-semibold px-2.5 py-1 text-emerald-600">✓ Wysłano link aktywacyjny</span>
  if (state === 'error') return <span className="text-xs font-semibold px-2.5 py-1 text-red-600">✗ Błąd</span>
  if (state === 'loading') return <span className="text-xs font-semibold px-2.5 py-1 text-sky-600">…</span>

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs font-semibold px-2.5 py-1 rounded-md bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors whitespace-nowrap"
      >
        Resetuj hasło ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
            <button
              onClick={() => { setOpen(false); onSendEmail() }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 text-gray-700"
            >
              Wyślij maila
            </button>
            <button
              onClick={() => { setOpen(false); onGenerateLink() }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 text-gray-700"
            >
              Generuj link
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function EditEnrollmentModal({ enrollment, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name:       enrollment.first_name || '',
    last_name:        enrollment.last_name  || '',
    pesel:            enrollment.pesel      || '',
    birth_date:       enrollment.birth_date || '',
    email:            enrollment.email      || '',
    phone:            enrollment.phone      || '',
    zip_code:         enrollment.zip_code   || '',
    city:             enrollment.city       || '',
    street:           enrollment.street     || '',
    house_number:     enrollment.house_number     || '',
    apartment_number: enrollment.apartment_number || '',
    photo_consent:    enrollment.photo_consent    ?? false,
    payment_status:   enrollment.payment_status   || 'none',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const payload = {
        ...form,
        birth_date: form.birth_date || null,
      }
      // nie wysyłaj pustego PESEL-u – walidator backendu wymaga 11 cyfr lub brak pola
      if (!payload.pesel) delete payload.pesel
      const res = await adminUpdateEnrollment(enrollment.id, payload)
      onSaved(res.data)
      onClose()
    } catch (err) {
      setErrors(err.response?.data || { __all__: 'Błąd zapisu.' })
    } finally {
      setSaving(false)
    }
  }

  const field = (label, key, type = 'text', { extraClass = '', ...opts } = {}) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 ${errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'} ${extraClass}`}
        {...opts}
      />
      {errors[key] && <p className="text-xs text-red-600 mt-0.5">{errors[key]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Edytuj dane uczestnika</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Dane osobowe</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Imię', 'first_name')}
              {field('Nazwisko', 'last_name')}
              {enrollment.pesel
                ? field('PESEL', 'pesel', 'text', { maxLength: 11, extraClass: 'font-mono' })
                : <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">PESEL</label>
                    <input disabled value="usunięto" className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-300 italic bg-gray-50 cursor-not-allowed" />
                  </div>
              }
              {field('Data urodzenia', 'birth_date', 'date')}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Kontakt</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Email', 'email', 'email')}
              {field('Telefon', 'phone', 'tel')}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Adres</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Ulica', 'street')}
              <div className="grid grid-cols-2 gap-2">
                {field('Nr domu', 'house_number')}
                {field('Nr mieszkania', 'apartment_number')}
              </div>
              {field('Kod pocztowy', 'zip_code', 'text', { maxLength: 6 })}
              {field('Miasto', 'city')}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pozostałe</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Status płatności</label>
                <select
                  value={form.payment_status}
                  onChange={e => set('payment_status', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <option value="none">Brak</option>
                  <option value="deposit">Zaliczka</option>
                  <option value="paid">Opłacony</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  id="photo_consent_edit"
                  type="checkbox"
                  checked={form.photo_consent}
                  onChange={e => set('photo_consent', e.target.checked)}
                  className="w-4 h-4 accent-sky-600"
                />
                <label htmlFor="photo_consent_edit" className="text-sm text-gray-700">Zgoda na zdjęcia</label>
              </div>
            </div>
          </div>
          {errors.__all__ && <p className="text-xs text-red-600">{errors.__all__}</p>}
          <div className="flex gap-3 pt-1 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Zapisuję…' : 'Zapisz zmiany'}
            </button>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800 px-4 py-2.5 text-sm font-medium">Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  )
}

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

// ─── Tabela główna ────────────────────────────────────────────────────

function AnonymizeConfirm({ onConfirm, onCancel, busy }) {
  return (
    <div className="text-right">
      <p className="text-xs text-gray-600 mb-2 max-w-[260px] ml-auto leading-relaxed">
        Czy usunąć wszystkie dane wrażliwe użytkownika? Dane zostaną usunięte trwale.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {busy ? '…' : 'Tak, usuń dane'}
        </button>
        <button onClick={onCancel} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Anuluj</button>
      </div>
    </div>
  )
}

function EnrolledTable({ courseFilter, onSoftDeleted, refreshKey }) {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [confirmAnonId, setConfirmAnonId] = useState(null)
  const [anonBusyId, setAnonBusyId]       = useState(null)
  const [deletionModal, setDeletionModal] = useState(null)
  const [resetState, setResetState]       = useState({})
  const [linkModal, setLinkModal]         = useState(null)
  const [editModal, setEditModal]         = useState(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    adminFetchEnrollments(courseFilter)
      .then(setEnrollments)
      .catch(() => setError('Nie udało się pobrać uczestników.'))
      .finally(() => setLoading(false))
  }, [courseFilter, refreshKey])

  async function handlePasswordReset(id, email) {
    setResetState(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const res = await adminSendPasswordReset(email)
      setResetState(prev => ({ ...prev, [id]: `sent-${res.data.type}` }))
    } catch {
      setResetState(prev => ({ ...prev, [id]: 'error' }))
    }
    setTimeout(() => setResetState(prev => { const n = { ...prev }; delete n[id]; return n }), 3000)
  }

  async function handleGenerateLink(id, email) {
    setResetState(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const res = await adminGenerateResetLink(email)
      setLinkModal(res.data)
      setResetState(prev => { const n = { ...prev }; delete n[id]; return n })
    } catch {
      setResetState(prev => ({ ...prev, [id]: 'error' }))
      setTimeout(() => setResetState(prev => { const n = { ...prev }; delete n[id]; return n }), 3000)
    }
  }

  async function handleSoftDelete(id, reason) {
    try {
      await adminSoftDeleteEnrollment(id, reason)
      setEnrollments(prev => prev.filter(e => e.id !== id))
      setDeletionModal(null)
      onSoftDeleted?.()
    } catch {}
  }

  async function handleAnonymize(id) {
    setAnonBusyId(id)
    try {
      const res = await adminAnonymizeEnrollment(id)
      setEnrollments(prev => prev.map(e => e.id === id ? res.data : e))
      setConfirmAnonId(null)
    } finally {
      setAnonBusyId(null)
    }
  }

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">Ładowanie…</div>
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">{error}</div>
  if (enrollments.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
      Brak zapisanych uczestników{courseFilter ? ' dla wybranego kursu' : ''}.
    </div>
  )

  return (
    <>
      {linkModal && <ResetLinkModal link={linkModal.link} type={linkModal.type} onClose={() => setLinkModal(null)} />}
      {editModal && (
        <EditEnrollmentModal
          enrollment={editModal}
          onClose={() => setEditModal(null)}
          onSaved={updated => setEnrollments(prev => prev.map(e => e.id === updated.id ? updated : e))}
        />
      )}
      {deletionModal && !deletionModal._noDeposit && (
        <DeletionReasonModal
          participantName={`${deletionModal.last_name} ${deletionModal.first_name}`}
          onConfirm={reason => handleSoftDelete(deletionModal.id, reason)}
          onClose={() => setDeletionModal(null)}
        />
      )}
      {deletionModal?._noDeposit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeletionModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-900 mb-3">Usuń uczestnika</h2>
            <p className="text-sm text-gray-600 mb-5">
              Usunąć uczestnika <span className="font-semibold">{deletionModal.last_name} {deletionModal.first_name}</span>? Trafi na listę usuniętych.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleSoftDelete(deletionModal.id, '')} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">Usuń</button>
              <button onClick={() => setDeletionModal(null)} className="text-gray-500 hover:text-gray-800 px-4 py-2.5 text-sm font-medium">Anuluj</button>
            </div>
          </div>
        </div>
      )}
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left">
            <th className="px-5 py-3.5 font-semibold text-gray-600">Uczestnik</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">PESEL</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Data ur.</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Kontakt</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Adres</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Kurs</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Zaliczka</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Zgoda foto</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Zapisano</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Data egzaminu</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600 text-right">Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {enrollments.map(e => (
            <tr key={e.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-4 font-medium text-gray-900">{e.last_name} {e.first_name}</td>
              <td className="px-5 py-4 text-gray-600 font-mono tracking-wide">{e.pesel || <span className="text-gray-300 italic">usunięto</span>}</td>
              <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{e.birth_date ? formatDate(e.birth_date) : <span className="text-gray-300 italic">usunięto</span>}</td>
              <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                <div>{e.email}</div>
                <div>{e.phone || <span className="text-gray-300 italic">usunięto</span>}</div>
              </td>
              <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                {e.street ? (
                  <>
                    <div>{e.street} {e.house_number}{e.apartment_number ? `/${e.apartment_number}` : ''}</div>
                    <div>{e.zip_code} {e.city}</div>
                  </>
                ) : <span className="text-gray-300 italic">usunięto</span>}
              </td>
              <td className="px-5 py-4 text-gray-600 max-w-[200px]">
                <span className="text-xs line-clamp-2">{e.course_name}</span>
              </td>
              <td className="px-5 py-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : e.payment_status === 'deposit' ? 'bg-yellow-50 text-yellow-700' : 'bg-orange-50 text-orange-600'}`}>
                  {e.payment_status === 'paid' ? 'Opłacony' : e.payment_status === 'deposit' ? 'Zaliczka' : 'Brak'}
                </span>
              </td>
              <td className="px-5 py-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.photo_consent ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {e.photo_consent ? 'Tak' : 'Nie'}
                </span>
              </td>
              <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</td>
              <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{e.exam_date ? formatDate(e.exam_date) : <span className="text-gray-300 italic">—</span>}</td>
              <td className="px-4 py-4 text-right">
                {confirmAnonId === e.id ? (
                  <AnonymizeConfirm
                    onConfirm={() => handleAnonymize(e.id)}
                    onCancel={() => setConfirmAnonId(null)}
                    busy={anonBusyId === e.id}
                  />
                ) : (
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      onClick={() => setEditModal(e)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors whitespace-nowrap"
                    >
                      Edytuj dane
                    </button>
                    <button
                      onClick={() => e.payment_status !== 'none' ? setDeletionModal(e) : setDeletionModal({ ...e, _noDeposit: true })}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors whitespace-nowrap"
                    >
                      Usuń uczestnika
                    </button>
                    {e.pesel && <button
                      onClick={() => setConfirmAnonId(e.id)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors whitespace-nowrap"
                    >
                      Usuń dane wrażliwe
                    </button>}
                    {e.email && (
                      <ResetPasswordDropdown
                        id={e.id}
                        email={e.email}
                        resetState={resetState}
                        onSendEmail={() => handlePasswordReset(e.id, e.email)}
                        onGenerateLink={() => handleGenerateLink(e.id, e.email)}
                      />
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

// ─── Lista rezerwowa ──────────────────────────────────────────────────

function ReserveTable({ courses, onSoftDeleted, refreshKey }) {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading]           = useState(true)
  const [assigningId, setAssigningId]   = useState(null)
  const [selectedCourse, setSelectedCourse] = useState({})
  const [savingId, setSavingId]         = useState(null)
  const [confirmAnonId, setConfirmAnonId] = useState(null)
  const [anonBusyId, setAnonBusyId]       = useState(null)
  const [deletionModal, setDeletionModal] = useState(null)
  const [resetState, setResetState]       = useState({})
  const [linkModal, setLinkModal]         = useState(null)
  const [editModal, setEditModal]         = useState(null)

  useEffect(() => {
    setLoading(true)
    adminFetchUnassignedEnrollments()
      .then(setReservations)
      .finally(() => setLoading(false))
  }, [refreshKey])

  async function handlePasswordResetReserve(id, email) {
    setResetState(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const res = await adminSendPasswordReset(email)
      setResetState(prev => ({ ...prev, [id]: `sent-${res.data.type}` }))
    } catch {
      setResetState(prev => ({ ...prev, [id]: 'error' }))
    }
    setTimeout(() => setResetState(prev => { const n = { ...prev }; delete n[id]; return n }), 3000)
  }

  async function handleGenerateLinkReserve(id, email) {
    setResetState(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const res = await adminGenerateResetLink(email)
      setLinkModal(res.data)
      setResetState(prev => { const n = { ...prev }; delete n[id]; return n })
    } catch {
      setResetState(prev => ({ ...prev, [id]: 'error' }))
      setTimeout(() => setResetState(prev => { const n = { ...prev }; delete n[id]; return n }), 3000)
    }
  }

  async function handleAssign(enrollmentId) {
    const courseId = selectedCourse[enrollmentId]
    if (!courseId) return
    setSavingId(enrollmentId)
    try {
      await adminUpdateEnrollment(enrollmentId, { course: parseInt(courseId) })
      setReservations(prev => prev.filter(e => e.id !== enrollmentId))
      setAssigningId(null)
    } catch {
      // błąd (np. kurs pełny) - zostawiamy wiersz
    } finally {
      setSavingId(null)
    }
  }

  async function handleSoftDelete(id, reason) {
    try {
      await adminSoftDeleteEnrollment(id, reason)
      setReservations(prev => prev.filter(e => e.id !== id))
      setDeletionModal(null)
      onSoftDeleted?.()
    } catch {}
  }

  async function handleAnonymize(id) {
    setAnonBusyId(id)
    try {
      const res = await adminAnonymizeEnrollment(id)
      setReservations(prev => prev.map(e => e.id === id ? res.data : e))
      setConfirmAnonId(null)
    } finally {
      setAnonBusyId(null)
    }
  }

  if (loading) return (
    <div className="bg-white rounded-xl border border-amber-200 p-10 text-center text-gray-400 text-sm">Ładowanie…</div>
  )

  return (
    <>
      {linkModal && <ResetLinkModal link={linkModal.link} type={linkModal.type} onClose={() => setLinkModal(null)} />}
      {editModal && (
        <EditEnrollmentModal
          enrollment={editModal}
          onClose={() => setEditModal(null)}
          onSaved={updated => setReservations(prev => prev.map(e => e.id === updated.id ? updated : e))}
        />
      )}
      {deletionModal && !deletionModal._noDeposit && (
        <DeletionReasonModal
          participantName={`${deletionModal.last_name} ${deletionModal.first_name}`}
          onConfirm={reason => handleSoftDelete(deletionModal.id, reason)}
          onClose={() => setDeletionModal(null)}
        />
      )}
      {deletionModal?._noDeposit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeletionModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-900 mb-3">Usuń uczestnika</h2>
            <p className="text-sm text-gray-600 mb-5">Usunąć <span className="font-semibold">{deletionModal.last_name} {deletionModal.first_name}</span>? Trafi na listę usuniętych.</p>
            <div className="flex gap-3">
              <button onClick={() => handleSoftDelete(deletionModal.id, '')} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">Usuń</button>
              <button onClick={() => setDeletionModal(null)} className="text-gray-500 hover:text-gray-800 px-4 py-2.5 text-sm font-medium">Anuluj</button>
            </div>
          </div>
        </div>
      )}
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-900">Lista rezerwowa</h2>
        <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
          {reservations.length} {reservations.length === 1 ? 'osoba' : reservations.length < 5 ? 'osoby' : 'osób'}
        </span>
        <p className="text-sm text-gray-400">— uczestnicy nieprzypisani do żadnego kursu</p>
      </div>

      {reservations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
          Brak uczestników bez przypisanego kursu.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-amber-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-100 bg-amber-50 text-left">
                <th className="px-5 py-3.5 font-semibold text-gray-600">Uczestnik</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">PESEL</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Data ur.</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Kontakt</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Adres</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Zaliczka</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Zapisano</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {reservations.map(e => (
                <tr key={e.id} className="hover:bg-amber-50/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900">{e.last_name} {e.first_name}</td>
                  <td className="px-5 py-4 text-gray-600 font-mono tracking-wide">{e.pesel}</td>
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{e.birth_date ? formatDate(e.birth_date) : '-'}</td>
                  <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                    <div>{e.email}</div>
                    <div>{e.phone}</div>
                  </td>
                  <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                    <div>{e.street} {e.house_number}{e.apartment_number ? `/${e.apartment_number}` : ''}</div>
                    <div>{e.zip_code} {e.city}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : e.payment_status === 'deposit' ? 'bg-yellow-50 text-yellow-700' : 'bg-orange-50 text-orange-600'}`}>
                      {e.payment_status === 'paid' ? 'Opłacony' : e.payment_status === 'deposit' ? 'Zaliczka' : 'Brak'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                  <td className="px-4 py-4 text-right">
                    {confirmAnonId === e.id ? (
                      <AnonymizeConfirm
                        onConfirm={() => handleAnonymize(e.id)}
                        onCancel={() => setConfirmAnonId(null)}
                        busy={anonBusyId === e.id}
                      />
                    ) : assigningId === e.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <select
                          value={selectedCourse[e.id] || ''}
                          onChange={ev => setSelectedCourse(prev => ({ ...prev, [e.id]: ev.target.value }))}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 max-w-[220px]"
                        >
                          <option value="">— wybierz kurs —</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({formatDate(c.start_date)})
                              {c.spots_left <= 0 ? ' — PEŁNY' : ` · ${c.spots_left} miejsc`}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssign(e.id)}
                          disabled={!selectedCourse[e.id] || savingId === e.id}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {savingId === e.id ? '…' : 'Przypisz'}
                        </button>
                        <button
                          onClick={() => setAssigningId(null)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          Anuluj
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setAssigningId(e.id)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors whitespace-nowrap"
                          >
                            Przypisz do kursu
                          </button>
                          <button
                            onClick={() => setEditModal(e)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors whitespace-nowrap"
                          >
                            Edytuj dane
                          </button>
                          <button
                            onClick={() => e.payment_status !== 'none' ? setDeletionModal(e) : setDeletionModal({ ...e, _noDeposit: true })}
                            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors whitespace-nowrap"
                          >
                            Usuń uczestnika
                          </button>
                        </div>
                        {e.pesel && <button
                          onClick={() => setConfirmAnonId(e.id)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                        >
                          Usuń dane wrażliwe
                        </button>}
                        {e.email && (
                          <ResetPasswordDropdown
                            id={e.id}
                            email={e.email}
                            resetState={resetState}
                            onSendEmail={() => handlePasswordResetReserve(e.id, e.email)}
                            onGenerateLink={() => handleGenerateLinkReserve(e.id, e.email)}
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  )
}

// ─── Lista usuniętych ─────────────────────────────────────────────────

function DeletedList({ refreshKey, onRestored }) {
  const [deleted, setDeleted]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [confirmId, setConfirmId]     = useState(null)
  const [deletingId, setDeletingId]   = useState(null)
  const [restoringId, setRestoringId] = useState(null)

  useEffect(() => {
    setLoading(true)
    adminFetchDeletedEnrollments()
      .then(setDeleted)
      .finally(() => setLoading(false))
  }, [refreshKey])

  async function handleHardDelete(id) {
    setDeletingId(id)
    try {
      await adminDeleteEnrollment(id)
      setDeleted(prev => prev.filter(e => e.id !== id))
      setConfirmId(null)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRestore(id) {
    setRestoringId(id)
    try {
      await adminRestoreEnrollment(id)
      setDeleted(prev => prev.filter(e => e.id !== id))
      onRestored?.()
    } finally {
      setRestoringId(null)
    }
  }

  if (loading) return (
    <div className="bg-white rounded-xl border border-red-200 p-10 text-center text-gray-400 text-sm">Ładowanie…</div>
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-900">Lista usuniętych</h2>
        <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
          {deleted.length} {deleted.length === 1 ? 'osoba' : deleted.length < 5 ? 'osoby' : 'osób'}
        </span>
        <p className="text-sm text-gray-400">— uczestnicy usunięci z kursów, trwałe usunięcie możliwe stąd</p>
      </div>

      {deleted.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
          Brak usuniętych uczestników.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-red-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-100 bg-red-50 text-left">
                <th className="px-5 py-3.5 font-semibold text-gray-600">Uczestnik</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">PESEL</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Kontakt</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Ostatni kurs</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Zaliczka</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Powód rezygnacji</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600">Usunięto</th>
                <th className="px-5 py-3.5 font-semibold text-gray-600 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-50">
              {deleted.map(e => (
                <tr key={e.id} className="hover:bg-red-50/40 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900">{e.last_name} {e.first_name}</td>
                  <td className="px-5 py-4 text-gray-600 font-mono tracking-wide">{e.pesel || <span className="text-gray-300 italic">usunięto</span>}</td>
                  <td className="px-5 py-4 text-gray-600 text-xs leading-relaxed">
                    <div>{e.email}</div>
                    <div>{e.phone || <span className="text-gray-300 italic">usunięto</span>}</div>
                  </td>
                  <td className="px-5 py-4 text-gray-600 text-xs max-w-[200px]">
                    <span className="line-clamp-2">{e.course_name || <span className="text-gray-300 italic">brak</span>}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${e.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : e.payment_status === 'deposit' ? 'bg-yellow-50 text-yellow-700' : 'bg-orange-50 text-orange-600'}`}>
                      {e.payment_status === 'paid' ? 'Opłacony' : e.payment_status === 'deposit' ? 'Zaliczka' : 'Brak'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-600 text-xs max-w-[200px]">
                    {e.deletion_reason_display || <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(e.deleted_at)}</td>
                  <td className="px-4 py-4 text-right">
                    {confirmId === e.id ? (
                      <div className="text-right">
                        <p className="text-xs text-gray-600 mb-2 max-w-[220px] ml-auto">Trwale usunąć dane uczestnika z bazy?</p>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleHardDelete(e.id)}
                            disabled={deletingId === e.id}
                            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {deletingId === e.id ? '…' : 'Tak, usuń trwale'}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Anuluj</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          onClick={() => handleRestore(e.id)}
                          disabled={restoringId === e.id}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {restoringId === e.id ? 'Przywracanie…' : 'Przywróć'}
                        </button>
                        <button
                          onClick={() => setConfirmId(e.id)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors whitespace-nowrap"
                        >
                          Usuń trwale z bazy
                        </button>
                      </div>
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

export default function ParticipantList() {
  const [courses, setCourses]           = useState([])
  const [courseFilter, setCourseFilter] = useState('')
  const [deletedVersion, setDeletedVersion]   = useState(0)
  const [activeVersion, setActiveVersion]     = useState(0)

  useEffect(() => {
    adminFetchCourses().then(setCourses).catch(() => {})
  }, [])

  function handleSoftDeleted() {
    setDeletedVersion(v => v + 1)
  }

  function handleRestored() {
    setActiveVersion(v => v + 1)
  }

  return (
    <div className="p-8 space-y-10">
      {/* Główna lista */}
      <div>
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Uczestnicy</h1>
          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Wszystkie kursy</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <EnrolledTable courseFilter={courseFilter} onSoftDeleted={handleSoftDeleted} refreshKey={activeVersion} />
      </div>

      {/* Lista rezerwowa */}
      <ReserveTable courses={courses} onSoftDeleted={handleSoftDeleted} refreshKey={activeVersion} />

      {/* Lista usuniętych */}
      <DeletedList refreshKey={deletedVersion} onRestored={handleRestored} />
    </div>
  )
}
