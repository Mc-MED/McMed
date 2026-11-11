import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { fetchPayment, startPayment, fakeConfirmPayment } from '../../api/payments'

// /platnosc/:token          – podsumowanie i przejście do Przelewy24
// /platnosc/:token/status   – powrót z Przelewy24 (czekamy na potwierdzenie wpłaty)
// /platnosc/:token/symulacja – lokalna symulacja bramki (P24_MODE=fake)
export default function Payment({ view = 'summary' }) {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [info, setInfo]       = useState(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [checks, setChecks]   = useState(0)

  useEffect(() => {
    fetchPayment(token).then(setInfo).catch(() => setError('Nie znaleziono płatności. Sprawdź link z wiadomości e-mail.'))
  }, [token])

  // Po powrocie z bramki potwierdzenie przychodzi z P24 osobno — odpytujemy przez ok. minutę
  useEffect(() => {
    if (view !== 'status' || !info || info.paid || info.test_payment || checks >= 20) return
    const t = setTimeout(() => {
      fetchPayment(token).then(setInfo).catch(() => {})
      setChecks(c => c + 1)
    }, 3000)
    return () => clearTimeout(t)
  }, [view, info, checks, token])

  async function handlePay() {
    setLoading(true)
    setError('')
    try {
      const { redirect_url } = await startPayment(token)
      if (redirect_url.startsWith(window.location.origin)) {
        // Symulacja to ta sama strona (ten sam komponent) — bez tego przyciski zostałyby zablokowane
        setLoading(false)
        navigate(redirect_url.slice(window.location.origin.length))
      } else {
        window.location.href = redirect_url
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Nie udało się rozpocząć płatności. Spróbuj ponownie.')
      setLoading(false)
    }
  }

  async function handleSimulate(success) {
    setLoading(true)
    try {
      await fakeConfirmPayment(token, searchParams.get('session'), success)
      navigate(`/platnosc/${token}/status`)
    } catch {
      setError('Symulacja niedostępna (wymaga DEBUG=True i P24_MODE=fake).')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full shadow-sm">
        <span className="text-2xl font-extrabold text-gray-900 tracking-tight">Mc Med</span>

        {error && !info && <p className="mt-6 text-sm text-red-600">{error}</p>}
        {!error && !info && <p className="mt-6 text-sm text-gray-400">Ładowanie…</p>}

        {info && (
          <>
            <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-100 text-sm text-gray-700 space-y-1">
              <div><span className="font-medium">Uczestnik:</span> {info.first_name} {info.last_name}</div>
              <div><span className="font-medium">Kurs:</span> {info.course_name}</div>
              {info.proforma_number && <div><span className="font-medium">Proforma:</span> {info.proforma_number}</div>}
              <div><span className="font-medium">Kwota:</span> {info.amount} zł</div>
            </div>

            {info.paid ? (
              <div className="mt-6 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✓</span>
                </div>
                <h1 className="text-xl font-extrabold text-gray-900 mb-2">Kurs opłacony</h1>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Dziękujemy za wpłatę.
                  {info.invoice_number
                    ? ` Faktura nr ${info.invoice_number} została wysłana na Twój e-mail.`
                    : ' Fakturę wyślemy na Twój e-mail.'}
                </p>
              </div>
            ) : view === 'simulation' ? (
              <div className="mt-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 mb-4">
                  Tryb testowy – symulacja bramki Przelewy24. Żadne pieniądze nie są pobierane.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleSimulate(true)} disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm">
                    Płatność udana
                  </button>
                  <button onClick={() => handleSimulate(false)} disabled={loading}
                    className="border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-700 font-semibold py-2.5 rounded-lg text-sm">
                    Płatność odrzucona
                  </button>
                </div>
              </div>
            ) : view === 'status' && info.test_payment ? (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 leading-relaxed">
                Płatności online są w trakcie uruchamiania – ta płatność była testowa i nie pobrano żadnych pieniędzy.
                Kurs możesz opłacić przelewem na podstawie proformy z wiadomości e-mail lub gotówką.
              </div>
            ) : view === 'status' && checks < 20 && info.pending ? (
              <p className="mt-6 text-sm text-gray-500 text-center">Czekamy na potwierdzenie płatności…</p>
            ) : (
              <>
                {view === 'status' && (
                  <p className="mt-6 text-sm text-gray-500">
                    Płatność nie została jeszcze potwierdzona. Jeśli zapłaciłeś, potwierdzenie i faktura dotrą e-mailem.
                    Możesz też spróbować ponownie.
                  </p>
                )}
                <button onClick={handlePay} disabled={loading}
                  className="mt-6 w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm">
                  {loading ? 'Przekierowanie…' : 'Zapłać przez Przelewy24'}
                </button>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span>
                    Płatność zgodnie z{' '}
                    <a href="https://mcmed.pl/regulamin.html" target="_blank" rel="noopener noreferrer"
                      className="text-red-600 underline hover:text-red-700">Regulaminem</a>
                    {' '}(§ 4). Płatności obsługuje Przelewy24.
                  </span>
                  <img src="/przelewy24.svg" alt="Przelewy24" className="h-6 w-auto shrink-0" />
                </div>
                {info.sandbox && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 leading-relaxed">
                    <span className="font-bold">Uwaga: płatności online są w trakcie uruchamiania.</span>{' '}
                    Strona, na którą nastąpi przekierowanie, jest testowa – nie pobiera żadnych pieniędzy.
                    Kurs możesz opłacić przelewem na podstawie proformy z wiadomości e-mail lub gotówką.
                  </div>
                )}
              </>
            )}
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
