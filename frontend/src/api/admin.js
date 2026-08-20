import adminAxios from './adminAxios'

export const adminFetchCourses = () =>
  adminAxios.get('/api/courses/admin/').then(r => r.data)

export const adminCreateCourse = (data) =>
  adminAxios.post('/api/courses/admin/create/', data)

export const adminFetchCourse = (id) =>
  adminAxios.get(`/api/courses/admin/${id}/`).then(r => r.data)

export const adminUpdateCourse = (id, data) =>
  adminAxios.patch(`/api/courses/admin/${id}/`, data)

export const adminFetchEnrollments = (courseId) => {
  const params = courseId ? `?course=${courseId}` : ''
  return adminAxios.get(`/api/courses/enrollments/list/${params}`).then(r => r.data)
}

export const adminFetchUnassignedEnrollments = () =>
  adminAxios.get('/api/courses/enrollments/list/?unassigned=1').then(r => r.data)

export const adminDeleteEnrollment = (id) =>
  adminAxios.delete(`/api/courses/enrollments/${id}/`)

export const adminUpdateEnrollment = (id, data) =>
  adminAxios.patch(`/api/courses/enrollments/${id}/`, data)

export const adminAnonymizeEnrollment = (id) =>
  adminAxios.post(`/api/courses/enrollments/${id}/anonymize/`, {})

export const adminSoftDeleteEnrollment = (id, reason = '') =>
  adminAxios.post(`/api/courses/enrollments/${id}/remove/`, { reason })

export const adminFetchDeletedEnrollments = () =>
  adminAxios.get('/api/courses/enrollments/list/?deleted=1').then(r => r.data)

export const adminRestoreEnrollment = (id) =>
  adminAxios.post(`/api/courses/enrollments/${id}/restore/`, {})

export const adminFetchInstructors = () =>
  adminAxios.get('/api/courses/instructors/').then(r => r.data)

export const adminCreateInstructor = (data) =>
  adminAxios.post('/api/courses/instructors/', data)

export const adminUpdateInstructor = (id, data) =>
  adminAxios.patch(`/api/courses/instructors/${id}/`, data)

export const adminDeleteInstructor = (id) =>
  adminAxios.delete(`/api/courses/instructors/${id}/`)

export const adminSendEmail = (enrollmentIds, subject, body) =>
  adminAxios.post('/api/courses/enrollments/send-email/', { enrollment_ids: enrollmentIds, subject, body })

export const adminSendSms = (enrollmentIds, message) =>
  adminAxios.post('/api/courses/enrollments/send-sms/', { enrollment_ids: enrollmentIds, message })

export const adminDownloadDocument = async (courseId, filename, docName) => {
  const response = await adminAxios.get(`/api/documents/courses/${courseId}/${filename}/`, {
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
  const response = await adminAxios.get(`/api/documents/courses/${courseId}/pdf/${filename}/`, {
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
  const response = await adminAxios.get(`/api/documents/courses/${courseId}/xlsx/${filename}/`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `${docName}_kurs_${courseId}.xlsx`
  a.click()
  window.URL.revokeObjectURL(url)
}
