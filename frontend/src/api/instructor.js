import adminAxios from './adminAxios'

// Rola zalogowanego: 'admin' | 'instructor' | 'participant'
export const fetchMe = () =>
  adminAxios.get('/api/users/me/').then(r => r.data)

export const instructorFetchCourses = () =>
  adminAxios.get('/api/courses/instructor/').then(r => r.data)

export const instructorFetchCourse = (id) =>
  adminAxios.get(`/api/courses/instructor/${id}/`).then(r => r.data)

export const instructorFetchEnrollments = (courseId) =>
  adminAxios.get(`/api/courses/instructor/${courseId}/enrollments/`).then(r => r.data)

export const instructorUpdateEnrollment = (id, data) =>
  adminAxios.patch(`/api/courses/instructor/enrollments/${id}/`, data)
