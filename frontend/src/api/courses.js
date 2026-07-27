import axios from 'axios'

export const fetchCourses = () =>
  axios.get('/api/courses/').then(r => r.data)

export const submitEnrollment = (data) =>
  axios.post('/api/courses/enrollments/', data)

export const resendActivation = (email) =>
  axios.post('/api/users/resend-activation/', { email })
