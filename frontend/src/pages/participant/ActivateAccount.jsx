import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

export default function ActivateAccount() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // loading | success | error
  const [message, setMessage] = useState('')

  // StrictMode w dev odpala efekt dwa razy – aktywujemy tylko raz
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    axios.get(`/api/users/activate/${token}/`)
      .then(() => setState('success'))
      .catch(err => {
        setMessage(err.response?.data?.error || 'Wystąpił błąd. Spróbuj ponownie lub skontaktuj się z nami.')
        setState('error')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center shadow-sm">

        {state === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-5" />
            <p className="text-gray-500 text-sm">Aktywowanie konta…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-3">Konto aktywowane!</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Twoje konto Mc Med jest już aktywne. Możesz się teraz zalogować.
            </p>
            <a
              href="/zaloguj-sie"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              Przejdź do logowania
            </a>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-3">Nie udało się</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{message}</p>
            <a
              href="/"
              className="inline-block bg-gray-800 hover:bg-gray-900 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              Wróć na stronę główną
            </a>
          </>
        )}

      </div>
    </div>
  )
}
