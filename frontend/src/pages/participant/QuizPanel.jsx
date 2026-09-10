import { useState, useMemo, useEffect, useCallback } from 'react'
import kppQuestions from '../../data/kppQuestions'
import { fetchQuizProgress, saveQuizProgress } from '../../api/documents'

const EXAM_COUNT = 30
const LETTERS = ['A', 'B', 'C', 'D', 'E']

const CATEGORIES = [
  {
    id: 'c1', icon: '🫀',
    label: 'Wstrząs i stany nagłe',
    desc: 'Wstrząs, hipoglikemia, zawał serca, drgawki, zatrucia wziewne',
    nrFrom: 1, nrTo: 40,
  },
  {
    id: 'c2', icon: '🔥',
    label: 'Oparzenia, urazy i krwotoki',
    desc: 'Stopnie oparzeń, urazy mechaniczne, tamowanie krwotoków',
    nrFrom: 41, nrTo: 80,
  },
  {
    id: 'c3', icon: '🫁',
    label: 'Triage, drogi oddechowe i RKO',
    desc: 'Segregacja, udrażnianie dróg oddechowych, podstawy resuscytacji',
    nrFrom: 81, nrTo: 120,
  },
  {
    id: 'c4', icon: '💓',
    label: 'RKO, AED i badanie poszkodowanego',
    desc: 'Resuscytacja zaawansowana, defibrylacja, szybkie badanie urazowe',
    nrFrom: 121, nrTo: 160,
  },
  {
    id: 'c5', icon: '📋',
    label: 'Badanie urazowe i wsparcie psychiczne',
    desc: 'Badanie szczegółowe, uraz kręgosłupa, komunikacja z poszkodowanym',
    nrFrom: 161, nrTo: 200,
  },
  {
    id: 'c6', icon: '🧒',
    label: 'RKO u dzieci i urazy klatki',
    desc: 'Resuscytacja niemowląt i dzieci, ciało obce, urazy klatki piersiowej',
    nrFrom: 201, nrTo: 240,
  },
  {
    id: 'c7', icon: '⚖️',
    label: 'Krwotoki, urazy i uprawnienia',
    desc: 'Rodzaje wstrząsu i krwotoków, urazy klatki piersiowej, prawa ratownika',
    nrFrom: 241, nrTo: 999,
  },
]

function getCategoryQuestions(cat) {
  return kppQuestions.filter(q => q.nr >= cat.nrFrom && q.nr <= cat.nrTo)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Pasek postępu ──────────────────────────────────────────────────────
function ProgressBar({ current, total, color = 'bg-red-500' }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Widok pytania ──────────────────────────────────────────────────────
function QuestionView({ question, onAnswer, answer, showResult }) {
  const correct = question.correct
  return (
    <div>
      <p className="font-semibold text-gray-900 text-sm leading-relaxed mb-5">
        <span className="text-xs font-bold text-gray-400 mr-2">Nr {question.nr}.</span>
        {question.q}
      </p>
      <div className="space-y-2.5">
        {LETTERS.map(letter => {
          const text = question.options[letter]
          if (!text) return null
          const isSelected = answer === letter
          const isCorrect  = letter === correct
          let style = 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50 cursor-pointer'
          if (showResult) {
            if (isCorrect)         style = 'border-emerald-400 bg-emerald-50 cursor-default'
            else if (isSelected)   style = 'border-red-400 bg-red-50 cursor-default'
            else                   style = 'border-gray-200 bg-white cursor-default opacity-60'
          } else if (isSelected) {
            style = 'border-red-400 bg-red-50'
          }
          return (
            <button
              key={letter}
              onClick={() => !showResult && onAnswer(letter)}
              disabled={showResult}
              className={`w-full text-left flex items-start gap-3 border rounded-xl px-4 py-3 transition-colors ${style}`}
            >
              <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 ${
                showResult && isCorrect  ? 'border-emerald-500 bg-emerald-500 text-white'
                : showResult && isSelected ? 'border-red-500 bg-red-500 text-white'
                : isSelected             ? 'border-red-500 bg-red-500 text-white'
                : 'border-gray-300 text-gray-500'
              }`}>
                {letter}
              </span>
              <span className="text-sm text-gray-800 leading-relaxed">{text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Wyniki egzaminu ────────────────────────────────────────────────────
function ResultsView({ questions, answers, onRetry, onBack }) {
  const correct = questions.filter(q => answers[q.nr] === q.correct).length
  const total   = questions.length
  const pct     = Math.round((correct / total) * 100)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-6 text-center border-b border-gray-100 bg-gray-50">
        <div className="text-4xl mb-3">{pct >= 75 ? '🎉' : '📋'}</div>
        <h2 className="text-xl font-extrabold text-gray-900 mb-1">Wynik egzaminu</h2>
        <div className="text-4xl font-black mt-4 mb-1" style={{ color: pct >= 75 ? '#059669' : '#dc2626' }}>
          {correct} / {total}
        </div>
        <div className="text-lg font-bold text-gray-500">{pct}%</div>
        {pct >= 75
          ? <p className="text-sm text-emerald-600 mt-2 font-medium">Wynik powyżej progu zdawalności (75%)</p>
          : <p className="text-sm text-red-600 mt-2 font-medium">Wynik poniżej progu zdawalności (75%)</p>
        }
      </div>

      <div className="px-6 py-6 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Przegląd odpowiedzi</p>
        {questions.map(q => {
          const userAns = answers[q.nr]
          const isOk    = userAns === q.correct
          return (
            <details key={q.nr} className={`border rounded-xl overflow-hidden ${isOk ? 'border-emerald-200' : 'border-red-200'}`}>
              <summary className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${isOk ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className={`shrink-0 mt-0.5 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${isOk ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                  {isOk ? '✓' : '✗'}
                </span>
                <span className="text-xs text-gray-700 leading-snug">
                  <span className="font-bold text-gray-400 mr-1">Nr {q.nr}.</span>
                  {q.q.length > 80 ? q.q.slice(0, 80) + '…' : q.q}
                </span>
              </summary>
              <div className="px-4 py-3 bg-white text-xs space-y-1.5">
                <p className="text-gray-600 leading-relaxed mb-2">{q.q}</p>
                {LETTERS.map(l => {
                  if (!q.options[l]) return null
                  const isCorrectOpt = l === q.correct
                  const isUserOpt    = l === userAns
                  return (
                    <div key={l} className={`flex gap-2 ${isCorrectOpt ? 'text-emerald-700 font-semibold' : isUserOpt ? 'text-red-600 line-through' : 'text-gray-500'}`}>
                      <span className="font-bold shrink-0">{l}.</span>
                      <span>{q.options[l]}</span>
                      {isCorrectOpt && <span className="text-emerald-500">✓</span>}
                    </div>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>

      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onRetry}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
          Spróbuj ponownie
        </button>
        <button onClick={onBack}
          className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors">
          Wróć do kategorii
        </button>
      </div>
    </div>
  )
}

// ─── Karta kategorii ────────────────────────────────────────────────────
function CategoryCard({ cat, progress, onClick }) {
  const questions = getCategoryQuestions(cat)
  const total     = questions.length
  const done      = progress[cat.id] ?? 0
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 hover:border-red-300 hover:shadow-md rounded-2xl p-5 transition-all"
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl shrink-0 mt-0.5">{cat.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-bold text-gray-900 text-sm leading-snug">{cat.label}</h3>
            <span className="text-xs font-semibold text-gray-400 shrink-0">{total} pyt.</span>
          </div>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">{cat.desc}</p>
          <ProgressBar current={done} total={total} color={pct === 100 ? 'bg-emerald-500' : 'bg-red-500'} />
          <div className="flex justify-between text-xs mt-1.5">
            <span className={`font-medium ${pct === 100 ? 'text-emerald-600' : done > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {pct === 100 ? '✓ Ukończono' : done > 0 ? `Przerobiono ${done} / ${total}` : 'Nie zaczęto'}
            </span>
            <span className="text-gray-300">{pct}%</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Wybór trybu ────────────────────────────────────────────────────────
function ModeSelect({ cat, progress, onSelect, onBack }) {
  const questions   = getCategoryQuestions(cat)
  const lastIndex   = progress[cat.id] ?? 0
  const hasProgress = lastIndex > 0 && lastIndex < questions.length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8">
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-6">
        ← Wróć do kategorii
      </button>
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">{cat.icon}</div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">{cat.label}</h2>
        <p className="text-sm text-gray-400">{questions.length} pytań z zakresu KPP</p>
      </div>
      <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
        {hasProgress && (
          <button
            onClick={() => onSelect('kontynuuj')}
            className="flex items-center gap-4 border-2 border-red-400 bg-red-50 rounded-2xl px-5 py-4 transition-colors hover:bg-red-100 text-left"
          >
            <span className="text-3xl">▶️</span>
            <div>
              <div className="font-bold text-red-700 text-sm mb-0.5">Kontynuuj naukę</div>
              <div className="text-xs text-red-500">Pytanie {lastIndex + 1} / {questions.length}</div>
            </div>
          </button>
        )}
        <button
          onClick={() => onSelect('nauka')}
          className="flex items-center gap-4 border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-2xl px-5 py-4 transition-colors text-left"
        >
          <span className="text-3xl">📖</span>
          <div>
            <div className="font-bold text-gray-900 text-sm mb-0.5">{hasProgress ? 'Zacznij od nowa' : 'Nauka'}</div>
            <div className="text-xs text-gray-500">Wszystkie {questions.length} pytań z natychmiastową informacją zwrotną</div>
          </div>
        </button>
        <button
          onClick={() => onSelect('egzamin')}
          className="flex items-center gap-4 border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-2xl px-5 py-4 transition-colors text-left"
        >
          <span className="text-3xl">📝</span>
          <div>
            <div className="font-bold text-gray-900 text-sm mb-0.5">Egzamin próbny</div>
            <div className="text-xs text-gray-500">{Math.min(EXAM_COUNT, questions.length)} losowych pytań – wynik na końcu</div>
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Główny komponent ───────────────────────────────────────────────────
export default function QuizPanel() {
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [progress, setProgress]             = useState({})

  const [phase, setPhase]               = useState('categories')
  const [selectedCat, setSelectedCat]   = useState(null)
  const [mode, setMode]                 = useState(null)
  const [sessionKey, setSessionKey]     = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers]           = useState({})
  const [showResult, setShowResult]     = useState(false)
  const [finished, setFinished]         = useState(false)

  useEffect(() => {
    fetchQuizProgress()
      .then(data => setProgress(data))
      .catch(() => {})
      .finally(() => setProgressLoaded(true))
  }, [])

  const updateProgress = useCallback((catId, idx) => {
    if (!catId || catId === 'all') return
    setProgress(prev => ({ ...prev, [catId]: idx }))
    saveQuizProgress(catId, idx).catch(() => {})
  }, [])

  const catQuestions = useMemo(() => {
    if (!selectedCat) return []
    return getCategoryQuestions(selectedCat)
  }, [selectedCat])

  const questions = useMemo(() => {
    if (!selectedCat || !mode) return []
    if (mode === 'egzamin') return shuffle(catQuestions).slice(0, EXAM_COUNT)
    return catQuestions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCat, mode, sessionKey])

  const totalStudied = CATEGORIES.reduce((sum, cat) => {
    const total = getCategoryQuestions(cat).length
    const done  = Math.min(progress[cat.id] ?? 0, total)
    return sum + done
  }, 0)

  function openCategory(cat) {
    setSelectedCat(cat)
    setPhase('mode-select')
  }

  function startMode(m) {
    const startIdx = m === 'kontynuuj' ? (progress[selectedCat?.id] ?? 0) : 0
    if (m === 'nauka' && selectedCat?.id && selectedCat.id !== 'all') {
      updateProgress(selectedCat.id, 0)
    }
    setMode(m === 'kontynuuj' ? 'nauka' : m)
    setSessionKey(k => k + 1)
    setCurrentIndex(startIdx)
    setAnswers({})
    setShowResult(false)
    setFinished(false)
    setPhase('studying')
  }

  function handleAnswer(letter) {
    const q = questions[currentIndex]
    setAnswers(prev => ({ ...prev, [q.nr]: letter }))
    if (mode === 'nauka') {
      setShowResult(true)
      const nextIdx = currentIndex + 1
      updateProgress(selectedCat?.id, Math.min(nextIdx, questions.length))
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true)
      setPhase('results')
    } else {
      setCurrentIndex(i => i + 1)
      setShowResult(false)
    }
  }

  function goToCategories() {
    setPhase('categories')
    setSelectedCat(null)
    setMode(null)
    setFinished(false)
    setAnswers({})
  }

  if (!progressLoaded) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">
        Ładowanie postępu…
      </div>
    )
  }

  // ── Lista kategorii ────────────────────────────────────────────────
  if (phase === 'categories') {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-gray-900 text-base">Pytania egzaminacyjne KPP</h2>
            <p className="text-xs text-gray-400 mt-0.5">277 pytań · wybierz kategorię aby ćwiczyć</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-red-600">
              {Math.round((totalStudied / kppQuestions.length) * 100)}%
            </div>
            <div className="text-xs text-gray-400">{totalStudied} / {kppQuestions.length} pyt.</div>
          </div>
        </div>

        <div className="space-y-2">
          {CATEGORIES.map(cat => (
            <CategoryCard key={cat.id} cat={cat} progress={progress} onClick={() => openCategory(cat)} />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <button
            onClick={() => {
              setSelectedCat({ id: 'all', label: 'Wszystkie pytania', icon: '🎯', desc: '', nrFrom: 1, nrTo: 999 })
              setPhase('mode-select')
            }}
            className="w-full flex items-center gap-3 text-left"
          >
            <span className="text-3xl">🎯</span>
            <div>
              <div className="font-bold text-gray-900 text-sm">Wszystkie pytania</div>
              <div className="text-xs text-gray-500">Nauka lub egzamin z pełnej puli 277 pytań</div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── Wybór trybu ────────────────────────────────────────────────────
  if (phase === 'mode-select') {
    return (
      <ModeSelect
        cat={selectedCat}
        progress={progress}
        onSelect={startMode}
        onBack={goToCategories}
      />
    )
  }

  // ── Wyniki ─────────────────────────────────────────────────────────
  if (phase === 'results') {
    return (
      <ResultsView
        questions={questions}
        answers={answers}
        onRetry={() => startMode(mode)}
        onBack={() => setPhase('mode-select')}
      />
    )
  }

  // ── Nauka / Egzamin ────────────────────────────────────────────────
  if (!questions.length || finished) return null

  const question      = questions[currentIndex]
  const userAnswer    = answers[question.nr]
  const answeredCount = Object.keys(answers).length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPhase('mode-select')}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← Kategorie
          </button>
          <span className="text-gray-200">|</span>
          <span className="text-xs text-gray-500 font-semibold truncate max-w-[180px]">{selectedCat?.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-semibold">
            {mode === 'nauka'
              ? `${currentIndex + 1} / ${questions.length}`
              : `Pytanie ${currentIndex + 1} / ${questions.length} · Odpowiedziano: ${answeredCount}`}
          </span>
          {mode === 'nauka' && selectedCat?.id !== 'all' && (
            <button
              onClick={() => startMode('nauka')}
              className="text-xs text-gray-400 hover:text-red-600 underline underline-offset-2 transition-colors"
              title="Zacznij kategorię od początku"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pt-3">
        <ProgressBar current={currentIndex + 1} total={questions.length} />
        <div className="flex justify-between text-xs text-gray-300 mt-1 mb-4">
          <span>{mode === 'nauka' ? 'Nauka' : 'Egzamin próbny'}</span>
          <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        <QuestionView
          question={question}
          onAnswer={handleAnswer}
          answer={userAnswer}
          showResult={showResult}
        />

        {mode === 'nauka' && showResult && (
          <div className={`mt-4 px-4 py-3 rounded-xl ${userAnswer === question.correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm font-semibold ${userAnswer === question.correct ? 'text-emerald-700' : 'text-red-700'}`}>
              {userAnswer === question.correct
                ? '✓ Poprawna odpowiedź!'
                : `✗ Niepoprawna. Prawidłowa odpowiedź: ${question.correct}`}
            </p>
          </div>
        )}

        {mode === 'nauka' && showResult && (
          <button
            onClick={handleNext}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            {currentIndex + 1 >= questions.length ? 'Zakończ kategorię' : 'Następne pytanie →'}
          </button>
        )}

        {mode === 'egzamin' && (
          <div className="mt-4 flex gap-3">
            {currentIndex + 1 < questions.length ? (
              <button
                onClick={handleNext}
                disabled={!userAnswer}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                Następne →
              </button>
            ) : (
              <button
                onClick={() => { setFinished(true); setPhase('results') }}
                disabled={answeredCount < questions.length}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                {answeredCount < questions.length
                  ? `Odpowiedz na wszystkie (brakuje ${questions.length - answeredCount})`
                  : 'Zakończ egzamin i sprawdź wynik'}
              </button>
            )}
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentIndex(i => i - 1)}
                className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
              >
                ← Wróć
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
