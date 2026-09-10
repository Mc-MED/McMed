import { useEffect, useRef, useState } from 'react'
import { adminGetTopics, adminCreateTopic, adminUpdateTopic, adminDeleteTopic, adminUploadTopicFile, adminDeleteTopicFile } from '../../api/documents'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function TopicRow({ topic, onUpdated, onDeleted }) {
  const [expanded, setExpanded]         = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [newTitle, setNewTitle]         = useState(topic.title)
  const [savingTitle, setSavingTitle]   = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadMsg, setUploadMsg]       = useState(null)
  const [deletingFileId, setDeletingFileId] = useState(null)
  const [confirmDeleteFile, setConfirmDeleteFile] = useState(null)
  const fileRef = useRef()

  async function saveTitle() {
    if (!newTitle.trim() || newTitle === topic.title) { setEditingTitle(false); return }
    setSavingTitle(true)
    try {
      const updated = await adminUpdateTopic(topic.id, { title: newTitle.trim() })
      onUpdated(updated)
      setEditingTitle(false)
    } catch {
      // ignore
    } finally {
      setSavingTitle(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await adminDeleteTopic(topic.id)
      onDeleted(topic.id)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    setUploadMsg(null)
    try {
      const title = file.name.replace(/\.pdf$/i, '')
      const tf = await adminUploadTopicFile(topic.id, file, title)
      onUpdated({ ...topic, files: [...topic.files, tf] })
      setUploadMsg({ type: 'ok', text: 'Plik wgrany.' })
    } catch {
      setUploadMsg({ type: 'err', text: 'Błąd wgrywania. Dozwolony format: PDF.' })
    } finally {
      setUploadingFile(false)
      fileRef.current.value = ''
      setTimeout(() => setUploadMsg(null), 3000)
    }
  }

  async function handleDeleteFile(fileId) {
    setDeletingFileId(fileId)
    try {
      await adminDeleteTopicFile(fileId)
      onUpdated({ ...topic, files: topic.files.filter(f => f.id !== fileId) })
    } finally {
      setDeletingFileId(null)
      setConfirmDeleteFile(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Nagłówek działu */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none select-none w-5 shrink-0"
          title={expanded ? 'Zwiń' : 'Rozwiń'}
        >
          {expanded ? '▾' : '▸'}
        </button>

        {editingTitle ? (
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        ) : (
          <span
            className="flex-1 font-semibold text-gray-900 text-sm cursor-pointer"
            onClick={() => setExpanded(e => !e)}
          >
            {topic.title}
          </span>
        )}

        <span className="text-xs text-gray-400 shrink-0">{topic.files.length} {topic.files.length === 1 ? 'plik' : topic.files.length < 5 ? 'pliki' : 'plików'}</span>

        {editingTitle ? (
          <div className="flex gap-2 shrink-0">
            <button onClick={saveTitle} disabled={savingTitle} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors">
              {savingTitle ? '…' : 'Zapisz'}
            </button>
            <button onClick={() => { setEditingTitle(false); setNewTitle(topic.title) }} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Anuluj</button>
          </div>
        ) : confirmDelete ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500">Usunąć dział?</span>
            <button onClick={handleDelete} disabled={deleting} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors">
              {deleting ? '…' : 'Tak'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-700">Nie</button>
          </div>
        ) : (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setEditingTitle(true); setExpanded(true) }} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Zmień nazwę</button>
            <button onClick={() => setConfirmDelete(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">Usuń dział</button>
          </div>
        )}
      </div>

      {/* Zawartość (pliki) */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-2">
          {topic.files.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">Brak plików w tym dziale.</p>
          )}
          {topic.files.map(tf => (
            <div key={tf.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <span className="text-base shrink-0">📄</span>
              <span className="flex-1 text-sm font-medium text-gray-800 truncate">{tf.title}</span>
              <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{formatDate(tf.uploaded_at)}</span>
              {confirmDeleteFile === tf.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500">Usunąć?</span>
                  <button onClick={() => handleDeleteFile(tf.id)} disabled={deletingFileId === tf.id}
                    className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 transition-colors">
                    {deletingFileId === tf.id ? '…' : 'Tak'}
                  </button>
                  <button onClick={() => setConfirmDeleteFile(null)} className="text-xs text-gray-400 hover:text-gray-700">Nie</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteFile(tf.id)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0">
                  Usuń
                </button>
              )}
            </div>
          ))}

          {/* Wgraj plik */}
          <div className="pt-2 flex items-center gap-3">
            <label className={`inline-flex items-center gap-2 cursor-pointer bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${uploadingFile ? 'opacity-60 pointer-events-none' : ''}`}>
              📤 {uploadingFile ? 'Wgrywanie…' : 'Dodaj plik PDF'}
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
            </label>
            {uploadMsg && (
              <span className={`text-xs font-medium ${uploadMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{uploadMsg.text}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Materials() {
  const [topics, setTopics]         = useState([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [addingTopic, setAddingTopic]     = useState(false)
  const [showAddForm, setShowAddForm]     = useState(false)

  useEffect(() => {
    adminGetTopics()
      .then(setTopics)
      .catch(() => {})
      .finally(() => setTopicsLoading(false))
  }, [])

  async function handleAddTopic(e) {
    e.preventDefault()
    const title = newTopicTitle.trim()
    if (!title) return
    setAddingTopic(true)
    try {
      const topic = await adminCreateTopic(title)
      setTopics(prev => [...prev, { ...topic, files: [] }])
      setNewTopicTitle('')
      setShowAddForm(false)
    } finally {
      setAddingTopic(false)
    }
  }

  function handleTopicUpdated(updated) {
    setTopics(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  function handleTopicDeleted(id) {
    setTopics(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Materiały kursowe</h1>
      <p className="text-gray-500 text-sm mb-8">Działy tematyczne z plikami PDF widoczne dla uczestników.</p>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Działy tematyczne</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
          >
            + Dodaj dział
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddTopic} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nazwa nowego działu</label>
          <div className="flex gap-3">
            <input
              autoFocus
              value={newTopicTitle}
              onChange={e => setNewTopicTitle(e.target.value)}
              placeholder="np. Podstawy KPP"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <button type="submit" disabled={addingTopic || !newTopicTitle.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors">
              {addingTopic ? 'Dodawanie…' : 'Dodaj'}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setNewTopicTitle('') }}
              className="text-gray-500 hover:text-gray-700 text-sm px-3 py-2">Anuluj</button>
          </div>
        </form>
      )}

      {topicsLoading ? (
        <div className="text-center text-gray-400 py-10 text-sm">Ładowanie działów…</div>
      ) : topics.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <div className="text-3xl mb-3">📂</div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Brak działów</p>
          <p className="text-xs text-gray-400">Dodaj pierwszy dział i wgraj do niego pliki PDF dla uczestników.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map(topic => (
            <TopicRow
              key={topic.id}
              topic={topic}
              onUpdated={handleTopicUpdated}
              onDeleted={handleTopicDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
