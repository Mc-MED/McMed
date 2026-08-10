import { useState } from 'react'

const REASONS = [
  { value: 'forfeit',    label: 'Rezygnacja (bez powodu) – zaliczka przepadła' },
  { value: 'refund',     label: 'Rezygnacja z przyczyn losowych – zwrot zaliczki' },
  { value: 'reschedule', label: 'Rezygnacja z przyczyn losowych – zmiana terminu' },
]

export default function DeletionReasonModal({ participantName, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy]     = useState(false)

  async function handleConfirm() {
    if (!reason) return
    setBusy(true)
    try {
      await onConfirm(reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Usuń uczestnika</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Uczestnik <span className="font-semibold text-gray-900">{participantName}</span> wpłacił zaliczkę.
          Wybierz powód rezygnacji:
        </p>
        <div className="space-y-2 mb-5">
          {REASONS.map(r => (
            <label
              key={r.value}
              className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${
                reason === r.value
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="deletion-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="mt-0.5 accent-red-600 shrink-0"
              />
              <span className="text-sm text-gray-700 leading-snug">{r.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={!reason || busy}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
          >
            {busy ? 'Usuwanie…' : 'Usuń uczestnika'}
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 px-4 py-2.5 text-sm font-medium">
            Anuluj
          </button>
        </div>
      </div>
    </div>
  )
}
