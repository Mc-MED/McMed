import axios from 'axios'

const adminAxios = axios.create()

adminAxios.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing = null

adminAxios.interceptors.response.use(
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
          refresh: localStorage.getItem('refresh_token'),
        })
        .then(r => {
          localStorage.setItem('access_token', r.data.access)
          return r.data.access
        })
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
          return Promise.reject(new Error('session_expired'))
        })
        .finally(() => { refreshing = null })
    }

    const newToken = await refreshing
    original.headers.Authorization = `Bearer ${newToken}`
    return adminAxios(original)
  },
)

export default adminAxios
