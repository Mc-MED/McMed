import participantAxios from './participantAxios'

export const fetchMyEnrollments = () =>
  participantAxios.get('/api/courses/my-enrollments/').then(r => r.data)

export const fetchMyProfile = () =>
  participantAxios.get('/api/courses/my-profile/').then(r => r.data)

export const enrollMe = (courseId, extraData = {}) =>
  participantAxios.post('/api/courses/enroll-me/', { course: courseId, ...extraData })

export const cancelMyEnrollment = (id, reason) =>
  participantAxios.post(`/api/courses/my-enrollments/${id}/cancel/`, { reason })

export const downloadMyCertificate = async (enrollmentId) => {
  const response = await participantAxios.get(`/api/documents/my-certificate/${enrollmentId}/`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'certyfikat.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
