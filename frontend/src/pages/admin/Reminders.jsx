import { useEffect, useState } from 'react'
import {
  adminFetchRecertReminders, adminCreateTestReminder, adminSendTestReminderNow, adminDeleteTestReminder,
} from '../../api/admin'

function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

function formatDateTime(iso) {
  return iso ? new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUS = {
  planned:    { label: 'Zaplanowane',            cls: 'bg-gray-100 text-gray-600' },
  due:        { label: 'Do wysłania (cron)',     cls: 'bg-amber-100 text-amber-700' },
  sent:       { label: 'Wysłane',                cls: 'bg-green-100 text-green-700' },
  error:      { label: 'Błąd wysyłki',           cls: 'bg-red-100 text-red-700' },
  renewed:    { label: 'Pominięte – odnowił',    cls: 'bg-blue-100 text-blue-700' },
  expired:    { label: 'Wygasł',                 cls: 'bg-gray-100 text-gray-400' },
  no_contact: { label: 'Brak e-maila i telefonu', cls: 'bg-gray-100 text-gray-400' },
}

const FILTERS = [
  { key: 'upcoming', label: 'Nadchodzące', match: s => ['planned', 'due', 'error'].includes(s) },
  { key: 'sent',     label: 'Wysłane',     match: s => s === 'sent' },
  { key: 'all',      label: 'Wszystkie',   match: () => true },
]

function Channels({ emailAt, smsAt }) {
  if (!emailAt && !smsAt) return null
  return (
    <div className="text-xs text-gray-400 mt-1 space-y-0.5">
      {emailAt && <div>✉ mail {formatDateTime(emailAt)}</div>}
      {smsAt && <div>📱 SMS {formatDateTime(smsAt)}</div>}
    </div>
  )
}

export default function Reminders() {
  const [data, setData]       = useState(null)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState('upcoming')
  const [form, setForm]       = useState({ email: '', phone: '', send_on: todayIso() })
  const [formErrors, setFormErrors] = useState({})
  const [busy, setBusy]       = useState(null)

  function load() {
    adminFetchRecertReminders()
      .then(setData)
      .catch(() => setError('Nie udało się pobrać przypomnień.'))
  }

  useEffect(load, [])

  async function run(key, action) {
    setBusy(key)
    setError('')
    try {
      await action()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Operacja nie powiodła się.')
    } finally {
      setBusy(null)
    }
  }

  async function submitTest(e) {
    e.preventDefault()
    setFormErrors({})
    setBusy('create')
    try {
      await adminCreateTestReminder(form)
      setForm(f => ({ ...f, email: '', phone: '' }))
      load()
    } catch (err) {
      setFormErrors(err.response?.data || { detail: 'Nie udało się zapisać testu.' })
    } finally {
      setBusy(null)
    }
  }

  const rows = (data?.rows || []).filter(FILTERS.find(f => f.key === filter).match)
  const tests = data?.tests || []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Powiadomienia przypominające</h1>
        <p className="text-sm text-gray-500 mt-1">
          Certyfikat jest ważny 3 lata. Mail i SMS z przypomnieniem o recertyfikacji idą 3 miesiące przed wygaśnięciem –
          wysyła je codzienny cron.
        </p>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {/* ── Test ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-900">Test wysyłki</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Przykładowe przypomnienie (certyfikat TEST/1/2024) na podany adres i numer. Cron wyśle je w wybranym dniu
          przy najbliższym uruchomieniu – tak sprawdzisz, czy cron działa. „Wyślij teraz” sprawdza sam mail i SMS bez crona.
        </p>
        <form onSubmit={submitTest} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] items-end">
          <div>
            <label className="field-label">E-mail</label>
            <input type="email" className="field-input" value={form.email} placeholder="test@example.com"
              onChange={e => setForm({ ...form, email: e.target.value })} />
            {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
          </div>
          <div>
            <label className="field-label">Telefon</label>
            <input type="tel" className="field-input" value={form.phone} placeholder="500 600 700"
              onChange={e => setForm({ ...form, phone: e.target.value })} />
            {formErrors.phone && <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>}
          </div>
          <div>
            <label className="field-label">Data wysyłki</label>
            <input type="date" className="field-input" value={form.send_on} min={todayIso()}
              onChange={e => setForm({ ...form, send_on: e.target.value })} />
            {formErrors.send_on && <p className="text-xs text-red-600 mt-1">{formErrors.send_on}</p>}
          </div>
          <button type="submit" disabled={busy === 'create'}
            className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
            {busy === 'create' ? 'Zapisywanie…' : 'Zaplanuj test'}
          </button>
        </form>
        {formErrors.detail && <p className="text-sm text-red-600 mt-3">{formErrors.detail}</p>}

        {tests.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">Data wysyłki</th>
                  <th className="px-4 py-2 text-left">Odbiorca</th>
                  <th className="px-4 py-2 text-left">Wynik</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tests.map(t => (
                  <tr key={t.id} className="align-top">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(t.send_on)}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {t.email && <div>{t.email}</div>}
                      {t.phone && <div>{t.phone}</div>}
                    </td>
                    <td className="px-4 py-2">
                      {t.error ? (
                        <p className="text-xs text-red-600 whitespace-pre-line">{t.error}</p>
                      ) : !t.email_sent_at && !t.sms_sent_at ? (
                        <span className="text-xs text-gray-400">Czeka na crona</span>
                      ) : null}
                      <Channels emailAt={t.email_sent_at} smsAt={t.sms_sent_at} />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => run(`send-${t.id}`, () => adminSendTestReminderNow(t.id))}
                        disabled={busy === `send-${t.id}`}
                        className="text-xs text-red-600 hover:text-red-700 font-medium underline underline-offset-2 disabled:opacity-50">
                        {busy === `send-${t.id}` ? 'Wysyłanie…' : 'Wyślij teraz'}
                      </button>
                      <button onClick={() => run(`del-${t.id}`, () => adminDeleteTestReminder(t.id))}
                        disabled={busy === `del-${t.id}`}
                        className="ml-3 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50">
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Uczestnicy ── */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="font-bold text-gray-900">Uczestnicy z certyfikatem</h2>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md ${filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!data && !error && <p className="text-sm text-gray-400">Ładowanie…</p>}
        {data && rows.length === 0 && (
          <p className="text-sm text-gray-400">
            Brak uczestników w tym widoku. Przypomnienia liczą się od daty certyfikatu wpisanej przy uczestniku kursu.
          </p>
        )}

        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Imię i nazwisko</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Data uzyskania certyfikatu</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Data przypomnienia</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => {
                  const st = STATUS[r.status]
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.first_name} {r.last_name}</div>
                        <div className="text-xs text-gray-400">
                          {r.course_name}{r.cert_number && ` · nr ${r.cert_number}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.cert_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(r.reminder_date)}
                        <div className="text-xs text-gray-400">wygasa {formatDate(r.expiry_date)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                        {r.error && <p className="text-xs text-red-600 mt-1 whitespace-pre-line">{r.error}</p>}
                        <Channels emailAt={r.email_sent_at} smsAt={r.sms_sent_at} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
