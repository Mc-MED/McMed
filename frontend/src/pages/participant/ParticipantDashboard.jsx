import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMyEnrollments, cancelMyEnrollment } from '../../api/participant'

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

const CANCEL_REASONS = [
  { value: 'forfeit',    label: 'Rezygnacja bez podania przyczyny (zaliczka przepada)' },
  { value: 'refund',     label: 'Rezygnacja z przyczyn losowych – zwrot zaliczki' },
  { value: 'reschedule', label: 'Rezygnacja z przyczyn losowych – zmiana terminu' },
]

function CourseCard({ enrollment, onCancelled }) {
  const c = enrollment
  const end = c.end_date ? new Date(c.end_date) : null
  const isPast = end && end < new Date()

  const [showCancel, setShowCancel]   = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling]     = useState(false)
  const [cancelError, setCancelError] = useState('')

  async function handleConfirm() {
    if (!cancelReason) { setCancelError('Wybierz powód rezygnacji.'); return }
    setCanceling(true)
    setCancelError('')
    try {
      await cancelMyEnrollment(c.id, cancelReason)
      onCancelled(c.id)
    } catch {
      setCancelError('Wystąpił błąd. Spróbuj ponownie.')
      setCanceling(false)
    }
  }

  return (
    <div className={`bg-white rounded-2xl border ${isPast ? 'border-gray-200' : 'border-red-200'} shadow-sm overflow-hidden`}>
      <div className={`px-6 py-4 ${isPast ? 'bg-gray-50' : 'bg-red-50'} flex items-start justify-between gap-4`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              c.course_type === 'kpp' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {c.course_type_display || c.course_type}
            </span>
            {isPast && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Zakończony</span>}
          </div>
          <h3 className="font-bold text-gray-900 text-base leading-snug">{c.course_name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{c.course_city}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-400">Zaliczka</div>
          <span className={`text-xs font-bold ${c.deposit_paid ? 'text-emerald-600' : 'text-orange-500'}`}>
            {c.deposit_paid ? 'Wpłacona' : 'Brak'}
          </span>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Termin kursu</div>
          <div className="font-medium text-gray-800">{formatDate(c.start_date)} – {formatDate(c.end_date)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Egzamin</div>
          <div className="font-medium text-gray-800">
            {formatDate(c.exam_date)}
            {c.exam_location && <span className="text-gray-500 font-normal"> · {c.exam_location}</span>}
          </div>
        </div>
        {c.price && (
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Cena</div>
            <div className="font-medium text-gray-800">{c.price} zł</div>
          </div>
        )}
      </div>

      {c.course_days && c.course_days.filter(Boolean).length > 0 && (
        <div className="px-6 pb-4">
          <div className="text-xs text-gray-400 mb-2">Dni szkoleniowe</div>
          <div className="flex flex-wrap gap-2">
            {c.course_days.filter(Boolean).map((d, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-mono">
                {formatDate(d)}
              </span>
            ))}
          </div>
        </div>
      )}

      {!isPast && (
        <div className="px-6 pb-5">
          {!showCancel ? (
            <button
              onClick={() => setShowCancel(true)}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors underline underline-offset-2"
            >
              Rezygnuj z kursu
            </button>
          ) : (
            <div className="border border-red-200 bg-red-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">Podaj powód rezygnacji</p>
              <div className="space-y-2 mb-4">
                {CANCEL_REASONS.map(r => (
                  <label key={r.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`reason-${c.id}`}
                      value={r.value}
                      checked={cancelReason === r.value}
                      onChange={() => { setCancelReason(r.value); setCancelError('') }}
                      className="mt-0.5 accent-red-600"
                    />
                    <span className="text-sm text-gray-700">{r.label}</span>
                  </label>
                ))}
              </div>
              {cancelError && <p className="text-red-600 text-xs mb-3">{cancelError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={canceling}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {canceling ? 'Wysyłanie…' : 'Potwierdź rezygnację'}
                </button>
                <button
                  onClick={() => { setShowCancel(false); setCancelReason(''); setCancelError('') }}
                  disabled={canceling}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NavCard({ icon, title, description, active, soon, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={soon}
      className={`w-full text-left bg-white border rounded-xl p-5 shadow-sm transition-all ${
        active
          ? 'border-red-400 ring-2 ring-red-100'
          : soon
          ? 'border-gray-200 opacity-50 cursor-default'
          : 'border-gray-200 hover:border-red-300 hover:shadow-md'
      }`}
    >
      <div className="text-2xl mb-3">{icon}</div>
      <div className="font-semibold text-gray-900 text-sm mb-1">{title}</div>
      <div className="text-xs text-gray-500">{description}</div>
      {soon && <span className="inline-block mt-3 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Wkrótce</span>}
    </button>
  )
}

export default function ParticipantDashboard() {
  const [firstName, setFirstName] = useState('')
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCard, setActiveCard] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('participant_access_token')
    if (!token) { navigate('/zaloguj-sie'); return }
    const payload = decodeJwt(token)
    if (!payload) { navigate('/zaloguj-sie'); return }
    setFirstName(payload.first_name || payload.username || '')

    fetchMyEnrollments()
      .then(setEnrollments)
      .catch(() => navigate('/zaloguj-sie'))
      .finally(() => setLoading(false))
  }, [navigate])

  function handleLogout() {
    localStorage.removeItem('participant_access_token')
    localStorage.removeItem('participant_refresh_token')
    navigate('/zaloguj-sie')
  }

  function handleCancelled(id) {
    setEnrollments(prev => prev.filter(e => e.id !== id))
  }

  const upcoming = enrollments.filter(e => !e.end_date || new Date(e.end_date) >= new Date())
  const past     = enrollments.filter(e => e.end_date && new Date(e.end_date) < new Date())

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-lg font-extrabold text-gray-900 tracking-tight hover:text-red-600 transition-colors">
          Mc Med
        </a>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 font-medium">{firstName}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-600 transition-colors">
            Wyloguj
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Moje konto</h1>
        <p className="text-gray-500 text-sm mb-8">Strefa uczestnika Mc Med</p>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <NavCard
            icon="📋"
            title="Moje kursy"
            description="Historia i nadchodzące kursy"
            active={activeCard === 'courses'}
            onClick={() => setActiveCard(activeCard === 'courses' ? null : 'courses')}
          />
          <NavCard icon="📄" title="Materiały" description="Podręczniki i harmonogramy" soon />
          <NavCard icon="🏅" title="Certyfikaty" description="Wyniki egzaminów i zaświadczenia" soon />
        </div>

        {activeCard === 'courses' && (
          loading ? (
            <div className="text-center text-gray-400 py-10 text-sm">Ładowanie…</div>
          ) : enrollments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <div className="text-4xl mb-4">📋</div>
              <p className="font-semibold text-gray-700 mb-1">Brak zapisów na kurs</p>
              <p className="text-sm text-gray-400 mb-5">Zapisz się na kurs, aby zobaczyć go tutaj.</p>
              <a href="/zapisz-sie" className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors">
                Zapisz się na kurs
              </a>
            </div>
          ) : (
            <div className="space-y-8">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Nadchodzące</h2>
                  <div className="space-y-4">{upcoming.map(e => <CourseCard key={e.id} enrollment={e} onCancelled={handleCancelled} />)}</div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Zakończone</h2>
                  <div className="space-y-4">{past.map(e => <CourseCard key={e.id} enrollment={e} onCancelled={handleCancelled} />)}</div>
                </section>
              )}
            </div>
          )
        )}
      </main>
    </div>
  )
}
