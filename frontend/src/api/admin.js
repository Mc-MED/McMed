import axios from 'axios'

function authHeader() {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const adminFetchCourses = () =>
  axios.get('/api/courses/admin/', { headers: authHeader() }).then(r => r.data)

export const adminCreateCourse = (data) =>
  axios.post('/api/courses/admin/create/', data, { headers: authHeader() })

export const adminFetchCourse = (id) =>
  axios.get(`/api/courses/admin/${id}/`, { headers: authHeader() }).then(r => r.data)

export const adminUpdateCourse = (id, data) =>
  axios.patch(`/api/courses/admin/${id}/`, data, { headers: authHeader() })

export const adminFetchEnrollments = (courseId) => {
  const params = courseId ? `?course=${courseId}` : ''
  return axios.get(`/api/courses/enrollments/list/${params}`, { headers: authHeader() }).then(r => r.data)
}

export const adminFetchUnassignedEnrollments = () =>
  axios.get('/api/courses/enrollments/list/?unassigned=1', { headers: authHeader() }).then(r => r.data)

export const adminDeleteEnrollment = (id) =>
  axios.delete(`/api/courses/enrollments/${id}/`, { headers: authHeader() })

export const adminUpdateEnrollment = (id, data) =>
  axios.patch(`/api/courses/enrollments/${id}/`, data, { headers: authHeader() })

export const adminAnonymizeEnrollment = (id) =>
  axios.post(`/api/courses/enrollments/${id}/anonymize/`, {}, { headers: authHeader() })

export const adminSoftDeleteEnrollment = (id, reason = '') =>
  axios.post(`/api/courses/enrollments/${id}/remove/`, { reason }, { headers: authHeader() })

export const adminFetchDeletedEnrollments = () =>
  axios.get('/api/courses/enrollments/list/?deleted=1', { headers: authHeader() }).then(r => r.data)

export const adminRestoreEnrollment = (id) =>
  axios.post(`/api/courses/enrollments/${id}/restore/`, {}, { headers: authHeader() })

export const adminFetchInstructors = () =>
  axios.get('/api/courses/instructors/', { headers: authHeader() }).then(r => r.data)

export const adminCreateInstructor = (data) =>
  axios.post('/api/courses/instructors/', data, { headers: authHeader() })

export const adminUpdateInstructor = (id, data) =>
  axios.patch(`/api/courses/instructors/${id}/`, data, { headers: authHeader() })

export const adminDeleteInstructor = (id) =>
  axios.delete(`/api/courses/instructors/${id}/`, { headers: authHeader() })

export const adminSendEmail = (enrollmentIds, subject, body) =>
  axios.post('/api/courses/enrollments/send-email/', { enrollment_ids: enrollmentIds, subject, body }, { headers: authHeader() })

export const adminSendSms = (enrollmentIds, message) =>
  axios.post('/api/courses/enrollments/send-sms/', { enrollment_ids: enrollmentIds, message }, { headers: authHeader() })

export const adminDownloadDocument = async (courseId, filename, docName) => {
  const response = await axios.get(`/api/documents/courses/${courseId}/${filename}/`, {
    headers: authHeader(),
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `${docName}_kurs_${courseId}.docx`
  a.click()
  window.URL.revokeObjectURL(url)
}

export const adminDownloadDocumentPdf = async (courseId, filename, docName) => {
  const response = await axios.get(`/api/documents/courses/${courseId}/pdf/${filename}/`, {
    headers: authHeader(),
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${docName}_kurs_${courseId}.pdf`
  a.click()
  window.URL.revokeObjectURL(url)
}

export const adminDownloadXlsx = async (courseId, filename, docName) => {
  const response = await axios.get(`/api/documents/courses/${courseId}/xlsx/${filename}/`, {
    headers: authHeader(),
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `${docName}_kurs_${courseId}.xlsx`
  a.click()
  window.URL.revokeObjectURL(url)
}
