import { useEffect, useRef, useState } from 'react'
import { adminGetPresentation, adminUploadPresentation } from '../../api/documents'

export default function Materials() {
  const [presInfo, setPresInfo] = useState(null)
  const [presLoading, setPresLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    adminGetPresentation()
      .then(setPresInfo)
      .catch(() => setPresInfo({ has_file: false }))
      .finally(() => setPresLoading(false))
  }, [])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const data = await adminUploadPresentation(file)
      setPresInfo(data)
      setUploadMsg({ type: 'ok', text: 'Plik wgrany pomyślnie.' })
    } catch {
      setUploadMsg({ type: 'err', text: 'Błąd wgrywania. Upewnij się że to plik PDF.' })
    } finally {
      setUploading(false)
      fileRef.current.value = ''
    }
  }

  function formatDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Materiały kursowe</h1>
      <p className="text-gray-500 text-sm mb-8">Prezentacja PDF widoczna dla uczestników w ich panelu konta.</p>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Aktualna prezentacja</h2>

        {presLoading ? (
          <p className="text-sm text-gray-400 mb-4">Ładowanie…</p>
        ) : (
          <div className="mb-6">
            {presInfo?.has_file ? (
              <div className="flex items-center gap-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <span className="text-xl">✅</span>
                <div>
                  <div className="font-semibold">Plik wgrany</div>
                  <div className="text-emerald-600 text-xs mt-0.5">Ostatnia aktualizacja: {formatDate(presInfo.uploaded_at)}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <span className="text-xl">📄</span>
                <div className="font-medium">Brak wgranego pliku</div>
              </div>
            )}
          </div>
        )}

        {uploadMsg && (
          <p className={`text-sm mb-4 font-medium ${uploadMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
            {uploadMsg.text}
          </p>
        )}

        <label className={`inline-flex items-center gap-2 cursor-pointer bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          📤 {uploading ? 'Wgrywanie…' : presInfo?.has_file ? 'Podmień prezentację (PDF)' : 'Wgraj prezentację (PDF)'}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>

        <p className="text-xs text-gray-400 mt-3">Dozwolony format: PDF. Nowy plik zastępuje poprzedni.</p>
      </div>
    </div>
  )
}
