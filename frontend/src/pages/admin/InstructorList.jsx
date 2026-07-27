import { useEffect, useState } from 'react'
import { adminFetchInstructors, adminCreateInstructor, adminUpdateInstructor, adminDeleteInstructor } from '../../api/admin'

const SPECS = [
  { key: 'spec_L',   label: 'L',   title: 'lekarz systemu' },
  { key: 'spec_P',   label: 'P',   title: 'pielęgniarka systemu' },
  { key: 'spec_Ps',  label: 'Ps',  title: 'psycholog' },
  { key: 'spec_R',   label: 'R',   title: 'ratownik' },
  { key: 'spec_Rt',  label: 'Rt',  title: 'ratownictwo techniczne' },
  { key: 'spec_Rch', label: 'Rch', title: 'ratownictwo chemiczne' },
  { key: 'spec_Re',  label: 'Re',  title: 'ratownictwo ekologiczne' },
  { key: 'spec_Rwo', label: 'Rwo', title: 'ratownictwo wodne' },
  { key: 'spec_Rwy', label: 'Rwy', title: 'ratownictwo wysokościowe' },
]

const EMPTY_FORM = {
  first_name: '', last_name: '', title: '', profession: '',
  spec_L: false, spec_P: false, spec_Ps: false, spec_R: false,
  spec_Rt: false, spec_Rch: false, spec_Re: false, spec_Rwo: false, spec_Rwy: false,
}

export default function InstructorList() {
  const [instructors, setInstructors] = useState([])
  const [panel, setPanel]     = useState(null)   // null | 'create' | {instructor}
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try { setInstructors(await adminFetchInstructors()) } catch {}
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setPanel('create')
  }

  function openEdit(inst) {
    setForm({ ...EMPTY_FORM, ...inst })
    setPanel(inst)
  }

  function closePanel() { setPanel(null) }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (panel === 'create') {
        await adminCreateInstructor(form)
      } else {
        await adminUpdateInstructor(panel.id, form)
      }
      await load()
      closePanel()
    } catch {}
    setSaving(false)
  }

  async function handleDelete(id) {
    try {
      await adminDeleteInstructor(id)
      setDeleteId(null)
      await load()
    } catch {}
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Ratownicy</h1>
          <p className="text-sm text-gray-400 mt-0.5">Baza instruktorów do wyboru przy tworzeniu kursu</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          + Dodaj ratownika
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {instructors.length === 0 ? (
          <p className="text-center text-gray-400 py-16 text-sm">Brak ratowników w bazie.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Imię i nazwisko</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Tytuł</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Zawód</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Specjalizacje</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {instructors.map(inst => (
                <tr key={inst.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{inst.full_name}</td>
                  <td className="px-5 py-3 text-gray-500">{inst.title || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{inst.profession || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {inst.specializations.length === 0 && <span className="text-gray-400">—</span>}
                      {inst.specializations.map(s => (
                        <span key={s} className="bg-red-50 text-red-700 text-xs font-semibold px-2 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(inst)}
                        className="text-xs text-gray-500 hover:text-gray-800 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        Edytuj
                      </button>
                      {deleteId === inst.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(inst.id)}
                            className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                            Potwierdź
                          </button>
                          <button onClick={() => setDeleteId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            Anuluj
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteId(inst.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          Usuń
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Panel boczny */}
      {panel !== null && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={closePanel} />
          <div className="w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {panel === 'create' ? 'Nowy ratownik' : 'Edytuj ratownika'}
              </h2>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
            </div>

            <form onSubmit={handleSave} className="flex-1 px-6 py-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Imię *" name="first_name" value={form.first_name} onChange={handleChange} />
                <Field label="Nazwisko *" name="last_name" value={form.last_name} onChange={handleChange} />
              </div>
              <Field label="Tytuł (np. dr, mgr)" name="title" value={form.title} onChange={handleChange} required={false} />
              <Field label="Zawód" name="profession" value={form.profession} onChange={handleChange} required={false} />

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Specjalizacje</p>
                <div className="space-y-2">
                  {SPECS.map(({ key, label, title }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        name={key}
                        checked={form[key]}
                        onChange={handleChange}
                        className="h-4 w-4 accent-red-600 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        <span className="font-semibold text-red-700">{label}</span>
                        {' – '}{title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
                >
                  {saving ? 'Zapisywanie…' : 'Zapisz'}
                </button>
                <button type="button" onClick={closePanel}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, name, value, onChange, required = true }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </div>
  )
}
