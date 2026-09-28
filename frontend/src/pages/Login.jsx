import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { fetchMe } from '../api/instructor'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  // Ten sam formularz dla admina (/panel-42) i prowadzącego (/prowadzacy) — dokąd dalej, decyduje rola konta
  const isInstructorLogin = useLocation().pathname.startsWith('/prowadzacy')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/token/', {
        // Prowadzący logują się emailem (login = email małymi literami)
        username: isInstructorLogin ? email.trim().toLowerCase() : email,
        password,
      })
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      const { role } = await fetchMe()
      if (role === 'admin') {
        navigate('/admin')
      } else if (role === 'instructor') {
        navigate('/prowadzacy/kursy')
      } else {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setError('To konto nie ma dostępu do panelu.')
      }
    } catch {
      setError('Nieprawidłowy login lub hasło.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight">Mc Med</p>
          <p className="text-sm text-gray-400 mt-1">{isInstructorLogin ? 'Panel prowadzącego' : 'Panel zarządzania'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isInstructorLogin ? 'Email' : 'Login'}
            </label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={isInstructorLogin ? 'jan@example.com' : 'admin'}
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Hasło
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-2"
          >
            {loading ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>
      </div>
    </div>
  )
}
