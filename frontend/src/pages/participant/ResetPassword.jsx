import { useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

export default function ResetPassword() {
  const { token } = useParams()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [errors, setErrors]         = useState({})
  const [status, setStatus]         = useState('idle') // idle | loading | success | invalid
  const [serverError, setServerError] = useState('')

  function validate() {
    const e = {}
    if (password.length < 8) e.password = 'Hasło musi mieć min. 8 znaków.'
    if (password !== confirm) e.confirm = 'Hasła nie są zgodne.'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setServerError('')
    setStatus('loading')
    try {
      await axios.post(`/api/users/password-reset/${token}/`, { password })
      setStatus('success')
    } catch (err) {
      const data = err.response?.data
      if (data?.password) {
        setErrors({ password: data.password })
        setStatus('idle')
      } else {
        setServerError(data?.error || 'Link jest nieprawidłowy lub wygasł.')
        setStatus('invalid')
      }
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-3">Hasło zmienione</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Twoje hasło zostało pomyślnie zmienione. Możesz się teraz zalogować.
          </p>
          <a
            href="/zaloguj-sie"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
          >
            Zaloguj się
          </a>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm p-8 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">✕</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-3">Link wygasł</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">{serverError}</p>
          <a
            href="/zapomnialem-hasla"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
          >
            Wyślij nowy link
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
          <p className="text-sm text-gray-400 mt-1">Nowe hasło</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nowe hasło</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(er => ({ ...er, password: '' })) }}
              placeholder="min. 8 znaków"
              autoFocus
              className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Powtórz hasło</label>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setErrors(er => ({ ...er, confirm: '' })) }}
              placeholder="••••••••"
              className={`w-full border rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition ${errors.confirm ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm}</p>}
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
          >
            {status === 'loading' ? 'Zapisywanie…' : 'Ustaw nowe hasło'}
          </button>
        </form>
      </div>
    </div>
  )
}
