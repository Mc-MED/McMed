import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminFetchCourses } from '../../api/admin'

function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function isPast(c) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const ref = c.course_type === 'recert' ? c.exam_date : c.end_date
  if (!ref) return false
  return new Date(ref) < today
}

export default function CourseList() {
  const navigate = useNavigate()
  const [courses, setCourses]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [showPast, setShowPast]       = useState(false)

  useEffect(() => {
    adminFetchCourses()
      .then(setCourses)
      .catch(() => setError('Nie udało się pobrać kursów. Sprawdź czy jesteś zalogowany.'))
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
            <th className="px-5 py-3.5 font-semibold text-gray-600">Miejsca</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Cena</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(c => (
            <tr key={c.id} onClick={() => navigate(`/admin/courses/${c.id}`)}
              className={`transition-colors cursor-pointer ${muted ? 'hover:bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
              <td className="px-5 py-4 font-medium text-gray-900 max-w-xs">{c.name}</td>
              <td className="px-5 py-4 text-gray-500">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                  c.course_type === 'kpp' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {c.course_type === 'kpp' ? 'KPP' : 'Recertyfikacja'}
                </span>
              </td>
              <td className="px-5 py-4 text-gray-600">{c.city || '—'}</td>
              <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                {c.course_type === 'recert'
                  ? formatDate(c.exam_date)
                  : <>
                      {formatDate(c.start_date)}
                      {c.end_date && c.end_date !== c.start_date && ` – ${formatDate(c.end_date)}`}
                    </>
                }
              </td>
              <td className="px-5 py-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  c.is_full
                    ? 'bg-red-50 text-red-600'
                    : c.spots_left <= 3
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-green-50 text-green-700'
                }`}>
                  {c.is_full ? 'Brak miejsc' : `${c.spots_left} / ${c.max_participants}`}
                </span>
              </td>
              <td className="px-5 py-4 font-semibold text-gray-900">
                {c.price ? `${c.price} zł` : '—'}
              </td>
              <td className="px-5 py-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {c.is_active ? 'Aktywny' : 'Nieaktywny'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Kursy</h1>
          <p className="text-gray-500 text-sm">
            {!loading && !error && `${upcoming.length} nadchodzące · ${past.length} zakończone`}
          </p>
        </div>
        <Link
          to="/admin/courses/create"
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          + Utwórz kurs
        </Link>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          Ładowanie…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && courses.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          Brak kursów. <Link to="/admin/courses/create" className="text-red-600 hover:underline">Utwórz pierwszy kurs →</Link>
        </div>
      )}

      {!loading && !error && upcoming.length > 0 && (
        <CourseTable rows={upcoming} />
      )}

      {!loading && !error && upcoming.length === 0 && courses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Brak nadchodzących kursów.
        </div>
      )}

      {!loading && !error && past.length > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setShowPast(p => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <span className={`transition-transform ${showPast ? 'rotate-90' : ''}`}>▶</span>
            Zakończone ({past.length})
          </button>
          {showPast && <CourseTable rows={past} muted />}
        </div>
      )}
    </div>
  )
}
