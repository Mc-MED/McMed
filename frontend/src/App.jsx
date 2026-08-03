import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import CourseList from './pages/admin/CourseList'
import CourseCreate from './pages/admin/CourseCreate'
import CourseDetail from './pages/admin/CourseDetail'
import ParticipantList from './pages/admin/ParticipantList'
import InstructorList from './pages/admin/InstructorList'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import EnrollForm from './pages/participant/EnrollForm'
import ActivateAccount from './pages/participant/ActivateAccount'
import ParticipantLogin from './pages/participant/ParticipantLogin'
import ParticipantDashboard from './pages/participant/ParticipantDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Strefa uczestnika */}
        <Route path="/zapisz-sie" element={<EnrollForm />} />
        <Route path="/aktywuj/:token" element={<ActivateAccount />} />
        <Route path="/zaloguj-sie" element={<ParticipantLogin />} />
        <Route path="/konto" element={<ParticipantDashboard />} />

        {/* Panel właściciela */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/courses" replace />} />
          <Route path="courses" element={<CourseList />} />
          <Route path="courses/create" element={<CourseCreate />} />
          <Route path="courses/:id" element={<CourseDetail />} />
          <Route path="participants" element={<ParticipantList />} />
          <Route path="instructors" element={<InstructorList />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
