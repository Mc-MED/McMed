// Skan certyfikatu KPP i podpisane oświadczenie przy zapisie na recertyfikację
import axios from 'axios'
import adminAxios from './adminAxios'
import participantAxios from './participantAxios'

export const DOCUMENT_KINDS = [
  { kind: 'certificate', label: 'Certyfikat KPP' },
  { kind: 'statement',   label: 'Podpisane oświadczenie' },
]

export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
const MAX_SIZE = 10 * 1024 * 1024

/** Komunikat błędu albo '' — to samo, co sprawdza backend. */
export function checkDocumentFile(file) {
  if (!file) return ''
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return 'Dozwolone pliki: PDF, JPG, PNG.'
  if (file.size > MAX_SIZE) return 'Plik jest za duży (maks. 10 MB).'
  return ''
}

export function uploadErrorMessage(err) {
  return err?.response?.data?.detail || 'Nie udało się przesłać pliku. Spróbuj ponownie.'
}

function form(kind, file) {
  const data = new FormData()
  data.append('kind', kind)
  data.append('file', file)
  return data
}

function filenameFrom(response, fallback) {
  const header = response.headers['content-disposition'] || ''
  const encoded = /filename\*=utf-8''([^;]+)/i.exec(header)   // nazwy z polskimi znakami
  if (encoded) {
    try { return decodeURIComponent(encoded[1]) } catch { /* zwykła nazwa niżej */ }
  }
  const match = /filename="([^"]+)"/.exec(header)
  return match ? match[1] : fallback
}

function saveBlob(response, fallbackName) {
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filenameFrom(response, fallbackName)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Otwiera plik w nowej karcie (okno otwierane od razu, żeby nie blokowała go przeglądarka). */
async function openBlob(request, fallbackName) {
  const win = window.open('', '_blank')
  try {
    const response = await request()
    if (!win) { saveBlob(response, fallbackName); return }
    win.location.href = URL.createObjectURL(response.data)
  } catch (err) {
    win?.close()
    throw err
  }
}

// ─── Uczestnik ───────────────────────────────────────────────────────

const myBase = id => `/api/courses/my-enrollments/${id}`

export const uploadMyDocument = (enrollmentId, kind, file) =>
  participantAxios.post(`${myBase(enrollmentId)}/documents/`, form(kind, file)).then(r => r.data)

export const deleteMyDocument = (enrollmentId, kind) =>
  participantAxios.delete(`${myBase(enrollmentId)}/documents/${kind}/`).then(r => r.data)

export const openMyDocument = (enrollmentId, kind) =>
  openBlob(() => participantAxios.get(`${myBase(enrollmentId)}/documents/${kind}/`, { responseType: 'blob' }), kind)

export const downloadMyStatement = async enrollmentId =>
  saveBlob(await participantAxios.get(`${myBase(enrollmentId)}/statement/`, { responseType: 'blob' }), 'oswiadczenie.pdf')

// Zaraz po zapisie przez formularz publiczny (konto jeszcze nieaktywne)
export const uploadDocumentByToken = (token, kind, file) =>
  axios.post(`/api/courses/enrollments/upload/${token}/`, form(kind, file))

// ─── Admin ───────────────────────────────────────────────────────────

const adminBase = id => `/api/courses/enrollments/${id}`

export const adminUploadDocument = (enrollmentId, kind, file) =>
  adminAxios.post(`${adminBase(enrollmentId)}/documents/`, form(kind, file)).then(r => r.data)

export const adminDeleteDocument = (enrollmentId, kind) =>
  adminAxios.delete(`${adminBase(enrollmentId)}/documents/${kind}/`).then(r => r.data)

export const adminOpenDocument = (enrollmentId, kind) =>
  openBlob(() => adminAxios.get(`${adminBase(enrollmentId)}/documents/${kind}/`, { responseType: 'blob' }), kind)

export const adminDownloadStatement = async enrollmentId =>
  saveBlob(await adminAxios.get(`${adminBase(enrollmentId)}/statement/`, { responseType: 'blob' }), 'oswiadczenie.pdf')
