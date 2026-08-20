import axios from 'axios'

const participantAxios = axios.create()

participantAxios.interceptors.request.use(config => {
  const token = localStorage.getItem('participant_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = null

participantAxios.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }
    original._retry = true

    if (!refreshing) {
      refreshing = axios
        .post('/api/auth/token/refresh/', {
          refresh: localStorage.getItem('participant_refresh_token'),
        })
        .then(r => {
          localStorage.setItem('participant_access_token', r.data.access)
          return r.data.access
        })
        .catch(() => {
          localStorage.removeItem('participant_access_token')
          localStorage.removeItem('participant_refresh_token')
          window.location.href = '/zaloguj'
          return Promise.reject(new Error('session_expired'))
        })
        .finally(() => { refreshing = null })
    }

    const newToken = await refreshing
    original.headers.Authorization = `Bearer ${newToken}`
    return participantAxios(original)
  },
)

export default participantAxios
