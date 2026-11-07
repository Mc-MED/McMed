import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  adminFetchCourses, adminFetchCoursePayments, adminMarkPaid, adminIssueProforma,
  adminRetryInvoice, adminDownloadInvoicePdf,
} from '../../api/admin'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pl-PL')
}

export default function Payments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const courseId = searchParams.get('kurs') || ''
  const [courses, setCourses] = useState([])
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(null)     // klucz akcji w toku
  const [confirmId, setConfirmId] = useState(null) // „Oznacz jako opłacony i wystaw fakturę” – potwierdzenie inline
  const [method, setMethod]   = useState('cash')

  useEffect(() => {
    adminFetchCourses().then(setCourses).catch(() => {})
  }, [])

  function load() {
    if (!courseId) { setData(null); return }
    setLoading(true)
    setError('')
    adminFetchCoursePayments(courseId)
      .then(setData)
      .catch(() => setError('Nie udało się pobrać płatności.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [courseId])

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
      setConfirmId(null)
    }
  }

  async function download(invoice) {
    try {
      await adminDownloadInvoicePdf(invoice)
    } catch {
      setError('Nie udało się pobrać PDF.')
    }
  }

  const rows = data?.enrollments || []
  const paidCount = rows.filter(r => r.invoice?.issued).length

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Płatności</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-1">
              Cena kursu: {data.course.price} zł · opłaconych z fakturą: <span className="font-semibold text-gray-800">{paidCount} / {rows.length}</span>
            </p>
          )}
        </div>
        <select
          value={courseId}
          onChange={e => setSearchParams(e.target.value ? { kurs: e.target.value } : {})}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">— Wybierz kurs —</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</p>}

      {!courseId && <p className="text-sm text-gray-400">Wybierz kurs z listy, aby zobaczyć płatności uczestników.</p>}
      {courseId && loading && !data && <p className="text-sm text-gray-400">Ładowanie…</p>}
      {data && rows.length === 0 && <p className="text-sm text-gray-400">Brak uczestników na tym kursie.</p>}

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Lp.</th>
                <th className="px-4 py-3 text-left">Uczestnik</th>
                <th className="px-4 py-3 text-left">Nabywca</th>
                <th className="px-4 py-3 text-left">Proforma</th>
                <th className="px-4 py-3 text-left">Płatność</th>
                <th className="px-4 py-3 text-left">Faktura</th>
                <th className="px-4 py-3 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 text-gray-400">{r.lp}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.last_name} {r.first_name}</div>
                    <div className="text-xs text-gray-400">{r.email}{r.phone && ` · ${r.phone}`}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.invoice_company ? (
                      <>
                        <div className="text-gray-800">{r.company_name}</div>
                        <div className="text-xs text-gray-400">NIP {r.company_nip}</div>
                      </>
                    ) : <span className="text-gray-500">Osoba prywatna</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.proforma ? (
                      <DocCell doc={r.proforma} busy={busy === `retry-${r.proforma.id}`}
                        onPdf={() => download(r.proforma)}
                        onRetry={() => run(`retry-${r.proforma.id}`, () => adminRetryInvoice(r.proforma.id))} />
                    ) : r.invoice?.issued ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <button
                        onClick={() => run(`proforma-${r.id}`, () => adminIssueProforma(r.id))}
                        disabled={busy === `proforma-${r.id}`}
                        className="text-xs text-red-600 hover:text-red-700 font-medium underline underline-offset-2 disabled:opacity-50"
                      >
                        {busy === `proforma-${r.id}` ? 'Wystawianie…' : 'Wystaw proformę'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3"><PaymentBadge row={r} /></td>
                  <td className="px-4 py-3">
                    {r.invoice ? (
                      <DocCell doc={r.invoice} busy={busy === `retry-${r.invoice.id}`} showSms
                        onPdf={() => download(r.invoice)}
                        onRetry={() => run(`retry-${r.invoice.id}`, () => adminRetryInvoice(r.invoice.id))} />
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!r.invoice && (
                      confirmId === r.id ? (
                        <span className="inline-flex items-center gap-2">
                          <select
                            value={method}
                            onChange={e => setMethod(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            <option value="cash">Gotówka</option>
                            <option value="transfer">Przelew</option>
                          </select>
                          <span className="text-xs text-gray-500">Wystawić fakturę i wysłać?</span>
                          <button
                            onClick={() => run(`paid-${r.id}`, () => adminMarkPaid(r.id, method))}
                            disabled={busy === `paid-${r.id}`}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                          >
                            {busy === `paid-${r.id}` ? 'Wystawianie…' : 'Tak'}
                          </button>
                          <button onClick={() => setConfirmId(null)} className="text-xs text-gray-500 hover:text-gray-700">Anuluj</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => { setConfirmId(r.id); setMethod('cash') }}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
                        >
                          Oznacz jako opłacony i wystaw fakturę
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PaymentBadge({ row }) {
  if (row.paid_method) {
    const label = { online: 'Opłacone online', cash: 'Gotówka', transfer: 'Przelew' }[row.paid_method] || 'Opłacony'
    return (
      <>
        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{label}</span>
        {row.paid_at && <div className="text-xs text-gray-400 mt-1">{formatDate(row.paid_at)}</div>}
      </>
    )
  }
  if (row.payment_status === 'paid')
    return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Opłacony (ręcznie)</span>
  if (row.payment_status === 'deposit')
    return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">Zaliczka</span>
  if (row.online_pending)
    return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Rozpoczęta online</span>
  return <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">Brak wpłaty</span>
}

function DocCell({ doc, busy, showSms, onPdf, onRetry }) {
  return (
    <div className="space-y-1">
      {doc.issued ? (
        <button onClick={onPdf} className="font-medium text-gray-900 hover:text-red-600 underline underline-offset-2 text-left">
          {doc.number}
        </button>
      ) : (
        <span className="text-xs font-semibold text-red-600">Nie wystawiono</span>
      )}
      {doc.issued && (
        <div className="text-xs text-gray-400">
          {formatDate(doc.created_at)}
          {' · '}
          <span className={doc.email_sent ? 'text-emerald-600' : 'text-gray-400'}>{doc.email_sent ? '✓' : '✗'} mail</span>
          {showSms && (
            <>
              {' · '}
              <span className={doc.sms_sent ? 'text-emerald-600' : 'text-gray-400'}>{doc.sms_sent ? '✓' : '✗'} SMS</span>
            </>
          )}
        </div>
      )}
      {doc.error && <div className="text-xs text-red-600 whitespace-pre-line max-w-xs">{doc.error}</div>}
      {(doc.error || !doc.issued || !doc.email_sent) && (
        <button onClick={onRetry} disabled={busy}
          className="text-xs text-red-600 hover:text-red-700 font-medium underline underline-offset-2 disabled:opacity-50">
          {busy ? 'Ponawianie…' : doc.issued ? 'Wyślij ponownie' : 'Wystaw ponownie'}
        </button>
      )}
    </div>
  )
}
