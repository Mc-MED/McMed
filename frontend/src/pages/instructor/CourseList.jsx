import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { instructorFetchCourses } from '../../api/instructor'

export function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function courseTerm(c) {
  if (c.course_type === 'recert') return formatDate(c.exam_date)
  if (c.end_date && c.end_date !== c.start_date) return `${formatDate(c.start_date)} – ${formatDate(c.end_date)}`
  return formatDate(c.start_date)
}

function isPast(c) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const ref = c.exam_date || c.end_date
  if (!ref) return false
  return new Date(ref) < today
}

export default function InstructorCourseList() {
  const navigate = useNavigate()
  const [courses, setCourses]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [showPast, setShowPast] = useState(false)

  useEffect(() => {
    instructorFetchCourses()
      .then(setCourses)
      .catch(() => setError('Nie udało się pobrać kursów.'))
      .finally(() => setLoading(false))
  }, [])

  const upcoming = courses.filter(c => !isPast(c))
  const past     = courses.filter(c =>  isPast(c))

  const CourseTable = ({ rows, muted = false }) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left">
            <th className="px-5 py-3.5 font-semibold text-gray-600">Kurs</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Typ</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Miasto</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Termin</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Egzamin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(c => (
            <tr key={c.id} onClick={() => navigate(`/prowadzacy/kursy/${c.id}`)}
              className={`transition-colors cursor-pointer hover:bg-gray-50 ${muted ? 'opacity-60' : ''}`}>
              <td className="px-5 py-4 font-medium text-gray-900">
                <div className="flex items-center gap-2">
                  {c.course_number && (
                    <span className="shrink-0 text-xs font-bold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                      #{c.course_number}
                    </span>
                  )}
                  {c.name}
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                  c.course_type === 'kpp' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {c.course_type === 'kpp' ? 'KPP' : 'Recertyfikacja'}
                </span>
              </td>
              <td className="px-5 py-4 text-gray-600">{c.city || '—'}</td>
              <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{courseTerm(c)}</td>
              <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                {formatDate(c.exam_date)}{c.exam_time && `, ${c.exam_time.slice(0, 5)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold text-gray-900">Moje kursy</h1>
      <p className="text-sm text-gray-400 mt-0.5 mb-6">Kursy, które prowadzisz lub w których jesteś w komisji egzaminacyjnej</p>

      {loading && <p className="text-gray-400 text-sm">Ładowanie…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!loading && !error && courses.length === 0 && (
        <p className="text-gray-400 text-sm">Nie masz jeszcze przypisanych kursów.</p>
      )}

      {upcoming.length > 0 && <CourseTable rows={upcoming} />}

      {past.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowPast(s => !s)}
            className="text-sm font-semibold text-gray-500 hover:text-gray-800 mb-3">
            {showPast ? '▾' : '▸'} Zakończone kursy ({past.length})
          </button>
          {showPast && <CourseTable rows={past} muted />}
        </div>
      )}
    </div>
  )
}
