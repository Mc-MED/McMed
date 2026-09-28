import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { instructorFetchCourse, instructorFetchEnrollments, instructorUpdateEnrollment } from '../../api/instructor'
import { ExamTab } from '../admin/CourseDetail'
import { courseTerm, formatDate } from './CourseList'

// Prowadzący wpisuje tylko egzamin praktyczny; teoretyczny i zbiorczy widzi bez edycji
const EDITABLE_EXAM_FIELDS = ['exam_rko', 'exam_zad1', 'exam_zad2']

function ParticipantsTab({ courseId }) {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    instructorFetchEnrollments(courseId)
      .then(setEnrollments)
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) return <p className="text-gray-400 text-sm mt-8">Ładowanie…</p>
  if (!enrollments.length) return <p className="text-gray-400 text-sm mt-8">Brak uczestników na tym kursie.</p>

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left">
            <th className="px-5 py-3.5 font-semibold text-gray-600 w-12">Lp.</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Imię i nazwisko</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Telefon</th>
            <th className="px-5 py-3.5 font-semibold text-gray-600">Email</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {enrollments.map((e, i) => (
            <tr key={e.id}>
              <td className="px-5 py-3 text-gray-400 font-medium">{String(i + 1).padStart(2, '0')}</td>
              <td className="px-5 py-3 font-medium text-gray-900">{e.last_name} {e.first_name}</td>
              <td className="px-5 py-3 text-gray-600">
                {e.phone ? <a href={`tel:${e.phone}`} className="hover:text-red-600">{e.phone}</a> : '—'}
              </td>
              <td className="px-5 py-3 text-gray-600">
                {e.email ? <a href={`mailto:${e.email}`} className="hover:text-red-600">{e.email}</a> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function InstructorCourseDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [course, setCourse]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState('uczestnicy')

  useEffect(() => {
    instructorFetchCourse(id)
      .then(setCourse)
      .catch(() => setError('Nie udało się pobrać kursu.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-gray-400 text-sm">Ładowanie…</div>
  if (error)   return <div className="p-8 text-red-600 text-sm">{error}</div>

  return (
    <div className="p-8">
      <button onClick={() => navigate('/prowadzacy/kursy')}
        className="text-sm text-gray-400 hover:text-red-600 transition-colors mb-6 block">
        ← Wróć do listy kursów
      </button>

      <h1 className="text-2xl font-extrabold text-gray-900">{course.name}</h1>
      <p className="text-gray-400 text-sm mt-1">
        {[course.city, courseTerm(course)].filter(Boolean).join(' · ')}
        {course.exam_date && (
          <> · Egzamin: {formatDate(course.exam_date)}{course.exam_time && `, ${course.exam_time.slice(0, 5)}`}
            {course.exam_location && `, ${course.exam_location}`}</>
        )}
      </p>

      {/* Zakładki */}
      <div className="flex gap-1 border-b border-gray-200 mt-6">
        {[['uczestnicy', 'Uczestnicy'], ['egzamin', 'Egzamin']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'uczestnicy' && <div className="max-w-5xl"><ParticipantsTab courseId={id} /></div>}
      {tab === 'egzamin' && (
        <div className="max-w-5xl">
          <ExamTab
            courseId={id}
            course={course}
            fetchEnrollments={instructorFetchEnrollments}
            updateEnrollment={instructorUpdateEnrollment}
            editableFields={EDITABLE_EXAM_FIELDS}
            showFillRandom={false}
            initialSubtab="praktyczny"
          />
        </div>
      )}
    </div>
  )
}
