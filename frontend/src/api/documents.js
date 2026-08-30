import adminAxios from './adminAxios'
import participantAxios from './participantAxios'

export async function adminGetPresentation() {
  const { data } = await adminAxios.get('/api/documents/admin/presentation/')
  return data
}

export async function adminUploadPresentation(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await adminAxios.post('/api/documents/admin/presentation/', formData)
  return data
}

export async function fetchPresentationBlob() {
  const response = await participantAxios.get('/api/documents/presentation/', {
    responseType: 'blob',
  })
  return response.data
}
