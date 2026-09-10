import adminAxios from './adminAxios'
import participantAxios from './participantAxios'

// ─── Tematy (admin) ───────────────────────────────────────────────────

export async function adminGetTopics() {
  const { data } = await adminAxios.get('/api/documents/admin/topics/')
  return data
}

export async function adminCreateTopic(title) {
  const { data } = await adminAxios.post('/api/documents/admin/topics/', { title })
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
