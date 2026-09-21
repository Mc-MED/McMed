import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

const TITLES = {
  '/panel-42':            'McMed – Logowanie',
  '/zapisz-sie':          'McMed – Zapisz się na kurs',
  '/zaloguj-sie':         'McMed – Logowanie',
  '/konto':               'McMed – Moje konto',
  '/zapomnialem-hasla':   'McMed – Przypomnij hasło',
  '/admin/courses':       'McMed – Kursy',
  '/admin/courses/create':'McMed – Nowy kurs',
  '/admin/participants':  'McMed – Uczestnicy',
  '/admin/instructors':   'McMed – Instruktorzy',
  '/admin/links':         'McMed – Linki',
  '/admin/materials':     'McMed – Materiały',
}

function TitleManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    const match = Object.keys(TITLES).find(path =>
      pathname === path || (path !== '/' && pathname.startsWith(path + '/'))
    )
    document.title = match ? TITLES[match] : 'McMed'
  }, [pathname])
  return null
}
import AdminLayout from './layouts/AdminLayout'
import CourseList from './pages/admin/CourseList'
import CourseCreate from './pages/admin/CourseCreate'
import CourseDetail from './pages/admin/CourseDetail'
import ParticipantList from './pages/admin/ParticipantList'
import InstructorList from './pages/admin/InstructorList'
import MaciusiLinks from './pages/admin/MaciusiLinks'
import Materials from './pages/admin/Materials'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import EnrollForm from './pages/participant/EnrollForm'
import ActivateAccount from './pages/participant/ActivateAccount'
import ParticipantLogin from './pages/participant/ParticipantLogin'
import ParticipantDashboard from './pages/participant/ParticipantDashboard'
import ForgotPassword from './pages/participant/ForgotPassword'
import ResetPassword from './pages/participant/ResetPassword'

export default function App() {
  return (
    <BrowserRouter>
      <TitleManager />
      <Routes>
        <Route path="/panel-42" element={<Login />} />

        {/* Strefa uczestnika */}
        <Route path="/zapisz-sie" element={<EnrollForm />} />
        <Route path="/aktywuj/:token" element={<ActivateAccount />} />
        <Route path="/zaloguj-sie" element={<ParticipantLogin />} />
        <Route path="/konto" element={<ParticipantDashboard />} />
        <Route path="/zapomnialem-hasla" element={<ForgotPassword />} />
        <Route path="/reset-hasla/:token" element={<ResetPassword />} />

        {/* Panel właściciela */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/courses" replace />} />
          <Route path="courses" element={<CourseList />} />
          <Route path="courses/create" element={<CourseCreate />} />
          <Route path="courses/:id" element={<CourseDetail />} />
          <Route path="participants" element={<ParticipantList />} />
          <Route path="instructors" element={<InstructorList />} />
          <Route path="links" element={<MaciusiLinks />} />
          <Route path="materials" element={<Materials />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
