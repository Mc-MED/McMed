import axios from 'axios'

function authHeader() {
  const token = localStorage.getItem('participant_access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const fetchMyEnrollments = () =>
  axios.get('/api/courses/my-enrollments/', { headers: authHeader() }).then(r => r.data)

export const fetchMyProfile = () =>
  axios.get('/api/courses/my-profile/', { headers: authHeader() }).then(r => r.data)

export const enrollMe = (courseId, extraData = {}) =>
  axios.post('/api/courses/enroll-me/', { course: courseId, ...extraData }, { headers: authHeader() })

export const cancelMyEnrollment = (id, reason) =>
  axios.post(`/api/courses/my-enrollments/${id}/cancel/`, { reason }, { headers: authHeader() })
