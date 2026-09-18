import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMyEnrollments, cancelMyEnrollment } from '../../api/participant'
import { fetchCourses } from '../../api/courses'
import { fetchTopics, fetchTopicFileBlob, fetchProgress, toggleFileProgress, fetchTopicQuiz, submitTopicQuiz, fetchTopicQuizResults } from '../../api/documents'
import PdfViewer from '../../components/PdfViewer'
import QuizPanel from './QuizPanel'

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

function formatCourseDays(course) {
  if (!course) return '—'
  if (course.course_type === 'recert') return formatDate(course.exam_date || course.start_date)
  const filled = (course.course_days || []).filter(d => d).sort()
  if (!filled.length) {
    if (course.start_date && course.end_date && course.start_date !== course.end_date)
      return `${formatDate(course.start_date)} – ${formatDate(course.end_date)}`
    return formatDate(course.start_date || course.end_date)
  }
  const groups = {}, order = []
  filled.forEach(iso => {
    const [y, m, d] = iso.split('-')
    const key = `${y}-${m}`
    if (!groups[key]) { groups[key] = { y, m, days: [] }; order.push(key) }
    groups[key].days.push(d)
  })
  return order.map(k => `${groups[k].days.join(', ')}.${groups[k].m}.${groups[k].y}`).join(' – ')
}

const CANCEL_REASONS = [
  { value: 'forfeit',    label: 'Rezygnacja bez podania przyczyny (zaliczka przepada)' },
  { value: 'refund',     label: 'Rezygnacja z przyczyn losowych – zwrot zaliczki (wymagany kontakt z organizatorem na min. 7 dni przed rozpoczęciem kursu)' },
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
          <div className="text-xs text-gray-400">Płatność</div>
          <span className={`text-xs font-bold ${c.payment_status === 'paid' ? 'text-emerald-600' : c.payment_status === 'deposit' ? 'text-yellow-600' : 'text-orange-500'}`}>
            {c.payment_status === 'paid' ? 'Opłacony' : c.payment_status === 'deposit' ? 'Zaliczka' : 'Brak'}
          </span>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Termin kursu</div>
          <div className="font-medium text-gray-800">{formatCourseDays(c)}</div>
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

function RecertCourseCard({ course }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${course.is_full ? 'border-gray-200 opacity-70' : 'border-blue-100'}`}>
      <div className="px-6 py-4 bg-blue-50 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-base leading-snug">{course.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{course.city}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-400 mb-0.5">Wolne miejsca</div>
          <span className={`text-sm font-bold ${course.is_full ? 'text-gray-400' : course.spots_left <= 3 ? 'text-orange-500' : 'text-emerald-600'}`}>
            {course.is_full ? 'Brak' : course.spots_left}
          </span>
        </div>
      </div>
      <div className="px-6 py-4 grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Termin</div>
          <div className="font-medium text-gray-800 text-xs">{formatCourseDays(course)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Egzamin</div>
          <div className="font-medium text-gray-800 text-xs">{formatDate(course.exam_date) || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Cena</div>
          <div className="font-medium text-gray-800 text-xs">{course.price} zł</div>
        </div>
      </div>
      <div className="px-6 pb-5">
        {course.is_full ? (
          <span className="inline-block text-xs font-semibold px-4 py-2 rounded-lg bg-gray-100 text-gray-400">
            Brak miejsc
          </span>
        ) : (
          <a
            href={`/zapisz-sie?kurs=${course.id}`}
            className="inline-block text-sm font-semibold px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Zapisz się
          </a>
        )}
      </div>
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
  const [recertCourses, setRecertCourses] = useState([])
  const [recertLoading, setRecertLoading] = useState(false)
  const [recertFetched, setRecertFetched] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfError, setPdfError] = useState('')

  // działy i pliki
  const [topics, setTopics]             = useState([])
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [topicsFetched, setTopicsFetched] = useState(false)
  const [openTopicId, setOpenTopicId]   = useState(null)
  const [openFileId, setOpenFileId]     = useState(null)
  const [fileLoading, setFileLoading]   = useState(false)
  const [fileError, setFileError]       = useState('')
  const fileUrlRef = useRef(null)
  const [completed, setCompleted]       = useState(new Set())
  const [togglingId, setTogglingId]     = useState(null)
  const [quizResults, setQuizResults]   = useState({}) // topicId → {score,total,passed}
  const [activeQuizId, setActiveQuizId] = useState(null) // topic id z otwartym quizem
  const [quizQuestions, setQuizQuestions] = useState([])
  const [quizLoading, setQuizLoading]   = useState(false)
  const [quizAnswers, setQuizAnswers]   = useState({}) // questionId → choiceId
  const [quizResult, setQuizResult]     = useState(null) // {score,total,passed,results}
  const [quizSubmitting, setQuizSubmitting] = useState(false)
  const [showPassedAnswers, setShowPassedAnswers] = useState(null) // topic id

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

  useEffect(() => {
    if (activeCard === 'materials') {
      if (!topicsFetched) {
        setTopicsLoading(true)
        Promise.all([fetchTopics(), fetchProgress(), fetchTopicQuizResults()])
          .then(([topicsData, progressIds, resultsData]) => {
            setTopics(topicsData)
            setCompleted(new Set(progressIds))
            const map = {}
            resultsData.forEach(r => { map[r.topic_id] = r })
            setQuizResults(map)
            setTopicsFetched(true)
          })
          .catch(() => {})
          .finally(() => setTopicsLoading(false))
      }
    }
    if (activeCard !== 'materials') {
      setOpenTopicId(null)
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current)
        fileUrlRef.current = null
      }
      setOpenFileId(null)
      setPdfUrl(null)
      setPdfError('')
    }
  }, [activeCard, topicsFetched])

  async function openFile(fileId) {
    if (openFileId === fileId) {
      // toggle – zamknij
      if (fileUrlRef.current) { URL.revokeObjectURL(fileUrlRef.current); fileUrlRef.current = null }
      setOpenFileId(null)
      setPdfUrl(null)
      return
    }
    if (fileUrlRef.current) { URL.revokeObjectURL(fileUrlRef.current); fileUrlRef.current = null }
    setOpenFileId(fileId)
    setPdfUrl(null)
    setFileLoading(true)
    setFileError('')
    try {
      const blob = await fetchTopicFileBlob(fileId)
      const url = URL.createObjectURL(blob)
      fileUrlRef.current = url
      setPdfUrl(url)
    } catch {
      setFileError('Nie udało się załadować pliku.')
    } finally {
      setFileLoading(false)
    }
  }

  async function handleToggleComplete(e, fileId) {
    e.stopPropagation()
    if (togglingId === fileId) return
    setTogglingId(fileId)
    try {
      const { completed: isNowDone } = await toggleFileProgress(fileId)
      setCompleted(prev => {
        const next = new Set(prev)
        isNowDone ? next.add(fileId) : next.delete(fileId)
        return next
      })
    } catch {
      // ignoruj błąd
    } finally {
      setTogglingId(null)
    }
  }

  async function openQuiz(topicId) {
    setActiveQuizId(topicId)
    setQuizResult(null)
    setQuizAnswers({})
    setQuizLoading(true)
    try {
      const questions = await fetchTopicQuiz(topicId)
      setQuizQuestions(questions)
    } catch {
      setQuizQuestions([])
    } finally {
      setQuizLoading(false)
    }
  }

  async function handleSubmitQuiz(topicId) {
    setQuizSubmitting(true)
    try {
      const result = await submitTopicQuiz(topicId, quizAnswers)
      setQuizResult(result)
      if (result.passed) {
        setQuizResults(prev => ({ ...prev, [topicId]: result }))
      } else {
        setQuizResults(prev => {
          const best = prev[topicId]
          if (!best || result.score > best.score) return { ...prev, [topicId]: result }
          return prev
        })
      }
    } catch {
      // ignoruj
    } finally {
      setQuizSubmitting(false)
    }
  }

  useEffect(() => {
    if (activeCard === 'recert' && !recertFetched) {
      setRecertLoading(true)
      fetchCourses()
        .then(data => {
          setRecertCourses(data.filter(c => c.course_type === 'recert'))
          setRecertFetched(true)
        })
        .catch(() => {})
        .finally(() => setRecertLoading(false))
    }
  }, [activeCard, recertFetched])

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
          <button onClick={handleLogout} className="text-sm font-semibold text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors">
            Wyloguj
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Moje konto</h1>
        <p className="text-gray-500 text-sm mb-8">Strefa uczestnika Mc Med</p>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-5 mb-4">
          <NavCard
            icon="📋"
            title="Moje kursy"
            description="Historia i nadchodzące kursy"
            active={activeCard === 'courses'}
            onClick={() => setActiveCard(activeCard === 'courses' ? null : 'courses')}
          />
          <NavCard
            icon="🔁"
            title="Recertyfikacje"
            description="Dostępne kursy recertyfikacyjne"
            active={activeCard === 'recert'}
            onClick={() => setActiveCard(activeCard === 'recert' ? null : 'recert')}
          />
          <NavCard
            icon="📄"
            title="Materiały"
            description="Podręczniki i harmonogramy"
            active={activeCard === 'materials'}
            onClick={() => setActiveCard(activeCard === 'materials' ? null : 'materials')}
          />
          <NavCard
            icon="🧠"
            title="Pytania"
            description="Nauka i egzamin próbny"
            active={activeCard === 'questions'}
            onClick={() => setActiveCard(activeCard === 'questions' ? null : 'questions')}
          />
          <NavCard icon="🏅" title="Certyfikaty" description="Wyniki egzaminów i zaświadczenia" soon />
        </div>

        {enrollments
          .filter(e => e.whatsapp_link && /^https?:\/\//i.test(e.whatsapp_link) && (!e.end_date || new Date(e.end_date) >= new Date()))
          .map(e => (
            <a
              key={e.id}
              href={e.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 w-full bg-[#25D366] hover:bg-[#1ebe5d] transition-colors text-white rounded-xl px-6 py-4 mb-4 shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold opacity-80 mb-0.5">Dołącz do grupy WhatsApp</div>
                <div className="font-bold text-sm truncate">{e.course_name}</div>
              </div>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0 opacity-70">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </a>
          ))
        }

        {activeCard === 'materials' && (
          topicsLoading ? (
            <div className="text-center text-gray-400 py-10 text-sm">Ładowanie materiałów…</div>
          ) : topics.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <div className="text-4xl mb-4">📄</div>
              <p className="font-semibold text-gray-700 mb-1">Brak materiałów</p>
              <p className="text-sm text-gray-400">Organizator nie dodał jeszcze materiałów kursowych.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map(topic => {
                const doneCount = topic.files.filter(tf => completed.has(tf.id)).length
                const allDone = topic.files.length > 0 && doneCount === topic.files.length
                return (
                <div key={topic.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenTopicId(id => id === topic.id ? null : topic.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-400 text-base leading-none">{openTopicId === topic.id ? '▾' : '▸'}</span>
                    <span className={`flex-1 font-semibold text-sm ${allDone ? 'text-emerald-700' : 'text-gray-900'}`}>{topic.title}</span>
                    {topic.files.length > 0 && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${allDone ? 'bg-emerald-100 text-emerald-700' : doneCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {doneCount}/{topic.files.length}
                      </span>
                    )}
                  </button>

                  {openTopicId === topic.id && (
                    <div className="border-t border-gray-100 px-5 py-3 space-y-2">
                      {topic.files.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-3">Brak plików w tym dziale.</p>
                      ) : topic.files.map(tf => {
                        const isDone = completed.has(tf.id)
                        const isToggling = togglingId === tf.id
                        return (
                        <div key={tf.id}>
                          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${
                            openFileId === tf.id ? 'bg-red-50 border border-red-200' : 'bg-gray-50 hover:bg-gray-100'
                          }`}>
                            <button
                              onClick={() => openFile(tf.id)}
                              className="flex-1 flex items-center gap-3 text-left min-w-0"
                            >
                              <span className="text-base shrink-0">📄</span>
                              <span className={`flex-1 text-sm font-medium truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{tf.title}</span>
                              {fileLoading && openFileId === tf.id ? (
                                <span className="text-xs text-gray-400 shrink-0">Ładowanie…</span>
                              ) : openFileId === tf.id ? (
                                <span className="text-xs text-red-600 font-semibold shrink-0">Zamknij ▴</span>
                              ) : (
                                <span className="text-xs text-gray-400 shrink-0">Otwórz ▾</span>
                              )}
                            </button>
                            <button
                              onClick={(e) => handleToggleComplete(e, tf.id)}
                              disabled={isToggling}
                              className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                                isDone
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-white border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
                              } ${isToggling ? 'opacity-50' : ''}`}
                            >
                              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 shrink-0">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              {isDone ? 'Ukończone' : 'Zrobione?'}
                            </button>
                          </div>
                          {openFileId === tf.id && !fileLoading && pdfUrl && (
                            <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
                              <PdfViewer url={pdfUrl} />
                            </div>
                          )}
                          {openFileId === tf.id && fileError && (
                            <p className="text-sm text-red-600 text-center py-3">{fileError}</p>
                          )}
                        </div>
                        )
                      })}

                      {/* Sekcja quizu */}
                      {topic.quiz_enabled && topic.question_count > 0 && (
                        <div className="border-t border-gray-100 pt-3 mt-1">
                          {quizResults[topic.id]?.passed ? (
                            <div>
                              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                                <span className="text-emerald-600 text-base">✓</span>
                                <span className="text-sm font-semibold text-emerald-700">Dział zaliczony</span>
                                <span className="text-xs text-emerald-500 ml-auto">
                                  {quizResults[topic.id].score}/{quizResults[topic.id].total}
                                  {quizResults[topic.id].attempted_at && (
                                    <span className="ml-2">
                                      {new Date(quizResults[topic.id].attempted_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </span>
                                <button
                                  onClick={() => {
                                    if (showPassedAnswers === topic.id) {
                                      setShowPassedAnswers(null)
                                    } else {
                                      setShowPassedAnswers(topic.id)
                                      openQuiz(topic.id)
                                    }
                                  }}
                                  className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors ml-2"
                                >
                                  {showPassedAnswers === topic.id ? 'Ukryj' : 'Odpowiedzi'}
                                </button>
                              </div>
                              {showPassedAnswers === topic.id && (
                                quizLoading && activeQuizId === topic.id ? (
                                  <div className="text-center text-gray-400 text-sm py-3">Ładowanie…</div>
                                ) : (
                                  <div className="mt-2 space-y-3">
                                    {quizQuestions.map((q, qi) => (
                                      <div key={q.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                                        <p className="text-sm font-medium text-gray-800 mb-2">{qi + 1}. {q.text}</p>
                                        <div className="space-y-1">
                                          {q.choices.map(c => (
                                            <div key={c.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm ${c.is_correct ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500'}`}>
                                              {c.is_correct ? <span className="shrink-0">✓</span> : <span className="shrink-0 w-3" />}
                                              {c.text}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )
                              )}
                            </div>
                          ) : activeQuizId === topic.id ? (
                            quizLoading ? (
                              <div className="text-center text-gray-400 text-sm py-3">Ładowanie pytań…</div>
                            ) : quizResult ? (
                              <div className={`p-4 rounded-xl border ${quizResult.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                <p className={`font-bold text-base mb-1 ${quizResult.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {quizResult.passed ? '✓ Zaliczone!' : '✗ Niezaliczone'}
                                </p>
                                <p className="text-sm text-gray-600 mb-1">Wynik: {quizResult.score}/{quizResult.total}</p>
                                {quizResult.attempted_at && (
                                  <p className="text-xs text-gray-400 mb-3">
                                    {new Date(quizResult.attempted_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                                <div className="space-y-2 mb-3">
                                  {quizQuestions.map((q, qi) => {
                                    const res = quizResult.results.find(r => r.question_id === q.id)
                                    return (
                                      <div key={q.id} className={`p-2 rounded-lg text-xs ${res?.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                        <span className="font-semibold">{qi + 1}. {q.text}</span>
                                        <div className="mt-1 space-y-1">
                                          {q.choices.map(c => {
                                            const isChosen = quizAnswers[q.id] === c.id
                                            const isCorrect = res?.correct_choice_id === c.id
                                            return (
                                              <div key={c.id} className={`flex items-center gap-1.5 ${isCorrect ? 'font-semibold' : ''} ${isChosen && !isCorrect ? 'line-through opacity-60' : ''}`}>
                                                <span>{isCorrect ? '✓' : isChosen ? '✗' : '·'}</span>
                                                <span>{c.text}</span>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                {!quizResult.passed && (
                                  <button
                                    onClick={() => { setQuizResult(null); setQuizAnswers({}) }}
                                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                                  >
                                    Spróbuj ponownie
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                                <p className="text-xs font-semibold text-gray-600 mb-3">Zaliczenie działu — {quizQuestions.length} pytań</p>
                                <div className="space-y-4 mb-4">
                                  {quizQuestions.map((q, qi) => (
                                    <div key={q.id}>
                                      <p className="text-sm font-medium text-gray-800 mb-2">{qi + 1}. {q.text}</p>
                                      <div className="space-y-1.5">
                                        {q.choices.map(c => (
                                          <label key={c.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                            quizAnswers[q.id] === c.id ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                                          }`}>
                                            <input
                                              type="radio"
                                              name={`quiz-${topic.id}-${q.id}`}
                                              checked={quizAnswers[q.id] === c.id}
                                              onChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: c.id }))}
                                              className="accent-red-600 shrink-0"
                                            />
                                            <span className="text-sm text-gray-700">{c.text}</span>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSubmitQuiz(topic.id)}
                                    disabled={quizSubmitting || quizQuestions.some(q => !quizAnswers[q.id])}
                                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
                                  >
                                    {quizSubmitting ? 'Sprawdzam…' : 'Sprawdź odpowiedzi'}
                                  </button>
                                  <button
                                    onClick={() => { setActiveQuizId(null); setQuizResult(null); setQuizAnswers({}) }}
                                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                  >
                                    Anuluj
                                  </button>
                                </div>
                              </div>
                            )
                          ) : (
                            <button
                              onClick={() => openQuiz(topic.id)}
                              className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                            >
                              Zaliczyć dział ({topic.question_count} {topic.question_count === 1 ? 'pytanie' : topic.question_count < 5 ? 'pytania' : 'pytań'})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )
        )}

        {activeCard === 'questions' && <QuizPanel />}

        {activeCard === 'recert' && (
          recertLoading ? (
            <div className="text-center text-gray-400 py-10 text-sm">Ładowanie…</div>
          ) : recertCourses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <div className="text-4xl mb-4">🔁</div>
              <p className="font-semibold text-gray-700 mb-1">Brak dostępnych recertyfikacji</p>
              <p className="text-sm text-gray-400">Sprawdź ponownie później lub skontaktuj się z organizatorem.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Dostępne terminy</p>
              {recertCourses.map(c => <RecertCourseCard key={c.id} course={c} />)}
            </div>
          )
        )}

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
