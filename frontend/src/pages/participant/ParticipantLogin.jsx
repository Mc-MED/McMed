import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function ParticipantLogin() {
  const [searchParams] = useSearchParams()
  const r = searchParams.get('redirect')
  const redirectTo = (r && r.startsWith('/') && !r.startsWith('//')) ? r : '/konto'

  const [email, setEmail]       = useState(searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/token/', { username: email, password })
      localStorage.setItem('participant_access_token', data.access)
      localStorage.setItem('participant_refresh_token', data.refresh)
      navigate(redirectTo)
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
          <a href="/" className="text-2xl font-extrabold text-gray-900 tracking-tight hover:text-red-600 transition-colors">
            Mc Med
          </a>
          <p className="text-sm text-gray-400 mt-1">Strefa uczestnika</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Adres e-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="adres@email.pl"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">Hasło</label>
              <a
                href={`/zapomnialem-hasla${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                className="text-xs text-red-600 hover:text-red-700 hover:underline"
              >
                Nie pamiętam hasła
              </a>
            </div>
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

        <p className="text-center text-xs text-gray-400 mt-6">
          Nie masz konta?{' '}
          <a href="/zapisz-sie" className="text-red-600 hover:underline font-medium">
            Zapisz się na kurs
          </a>
        </p>
      </div>
    </div>
  )
}
