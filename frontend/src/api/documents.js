import adminAxios from './adminAxios'
import participantAxios from './participantAxios'

// ─── Pliki kursu (admin) ──────────────────────────────────────────────

export async function adminGetCourseFiles(courseId) {
  const { data } = await adminAxios.get(`/api/documents/courses/${courseId}/uploads/`)
  return data
}

export async function adminUploadCourseFile(courseId, file, label) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('label', label || file.name)
  const { data } = await adminAxios.post(`/api/documents/courses/${courseId}/uploads/`, formData)
  return data
}

export async function adminDownloadCourseFile(fileId) {
  const response = await adminAxios.get(`/api/documents/course-files/${fileId}/`, { responseType: 'blob' })
  return response
}

export async function adminDeleteCourseFile(fileId) {
  return adminAxios.delete(`/api/documents/course-files/${fileId}/`)
}

// ─── Tematy (admin) ───────────────────────────────────────────────────

export async function adminGetTopics() {
  const { data } = await adminAxios.get('/api/documents/admin/topics/')
  return data
}

export async function adminCreateTopic(title) {
  const { data } = await adminAxios.post('/api/documents/admin/topics/', { title })
  return data
}

export async function adminToggleTopicQuiz(id, enabled) {
  const { data } = await adminAxios.patch(`/api/documents/admin/topics/${id}/`, { quiz_enabled: enabled })
  return data
}

export async function adminUpdateTopic(id, payload) {
  const { data } = await adminAxios.patch(`/api/documents/admin/topics/${id}/`, payload)
  return data
}

export async function adminDeleteTopic(id) {
  return adminAxios.delete(`/api/documents/admin/topics/${id}/`)
}

export async function adminUploadTopicFile(topicId, file, title) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title || file.name)
  const { data } = await adminAxios.post(`/api/documents/admin/topics/${topicId}/files/`, formData)
  return data
}

export async function adminDeleteTopicFile(fileId) {
  return adminAxios.delete(`/api/documents/admin/topic-files/${fileId}/`)
}

// ─── Tematy (uczestnik) ───────────────────────────────────────────────

export async function fetchTopics() {
  const { data } = await participantAxios.get('/api/documents/topics/')
  return data
}

export async function fetchTopicFileBlob(fileId) {
  const response = await participantAxios.get(`/api/documents/topic-files/${fileId}/`, {
    responseType: 'blob',
  })
  return response.data
}

export async function fetchProgress() {
  const { data } = await participantAxios.get('/api/documents/progress/')
  return data
}

export async function toggleFileProgress(fileId) {
  const { data } = await participantAxios.post(`/api/documents/topic-files/${fileId}/progress/`)
  return data
}

// ─── Pytania zaliczeniowe (admin) ─────────────────────────────────────

export async function adminCreateTopicQuestion(topicId, data) {
  const { data: res } = await adminAxios.post(`/api/documents/admin/topics/${topicId}/questions/`, data)
  return res
}

export async function adminDeleteTopicQuestion(questionId) {
  return adminAxios.delete(`/api/documents/admin/questions/${questionId}/`)
}

export async function adminUpdateTopicQuestion(questionId, data) {
  const { data: res } = await adminAxios.patch(`/api/documents/admin/questions/${questionId}/`, data)
  return res
}

// ─── Pytania zaliczeniowe (uczestnik) ─────────────────────────────────

export async function fetchTopicQuiz(topicId) {
  const { data } = await participantAxios.get(`/api/documents/topics/${topicId}/quiz/`)
  return data
}

export async function submitTopicQuiz(topicId, answers) {
  const { data } = await participantAxios.post(`/api/documents/topics/${topicId}/quiz/submit/`, { answers })
  return data
}

export async function fetchTopicQuizResults() {
  const { data } = await participantAxios.get('/api/documents/topic-quiz-results/')
  return data
}

export async function fetchQuizProgress() {
  const { data } = await participantAxios.get('/api/documents/quiz-progress/')
  return data
}

export async function saveQuizProgress(categoryId, lastIndex) {
  const { data } = await participantAxios.post('/api/documents/quiz-progress/', {
    category_id: categoryId,
    last_index: lastIndex,
  })
  return data
}
