import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const [email, setEmail]   = useState(searchParams.get('email') || '')
  const [status, setStatus] = useState('idle') // idle | loading | sent
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Podaj adres e-mail.'); return }
    setError('')
    setStatus('loading')
    try {
      await axios.post('/api/users/password-reset/', { email: email.trim().toLowerCase() })
    } catch {}
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">✉</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-3">Sprawdź skrzynkę</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Jeśli konto z adresem <span className="font-medium text-gray-700">{email}</span> istnieje,
            wysłaliśmy link do resetowania hasła. Sprawdź też folder SPAM.
          </p>
          <a
            href="/zaloguj-sie"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
          >
            Wróć do logowania
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm p-8">

        <div className="text-center mb-8">
          <a href="/" className="text-2xl font-extrabold text-gray-900 tracking-tight hover:text-red-600 transition-colors">
            Mc Med
          </a>
          <p className="text-sm text-gray-400 mt-1">Resetowanie hasła</p>
        </div>

        <p className="text-sm text-gray-500 mb-5 leading-relaxed">
          Podaj adres e-mail powiązany z kontem, a wyślemy link do ustawienia nowego hasła.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Adres e-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="adres@email.pl"
              autoFocus
              className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
          >
            {status === 'loading' ? 'Wysyłanie…' : 'Wyślij link'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/zaloguj-sie" className="text-red-600 hover:underline font-medium">
            ← Wróć do logowania
          </a>
        </p>
      </div>
    </div>
  )
}
