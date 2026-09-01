import { useState, useMemo } from 'react'
import kppQuestions from '../../data/kppQuestions'

const EXAM_COUNT = 30
const LETTERS = ['A', 'B', 'C', 'D', 'E']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
      <div className="bg-red-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

function QuestionView({ question, mode, onAnswer, answer, showResult }) {
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
          const isCorrect = letter === correct
          let style = 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50 cursor-pointer'
          if (showResult) {
            if (isCorrect) style = 'border-emerald-400 bg-emerald-50 cursor-default'
            else if (isSelected && !isCorrect) style = 'border-red-400 bg-red-50 cursor-default'
            else style = 'border-gray-200 bg-white cursor-default opacity-60'
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
                showResult && isCorrect ? 'border-emerald-500 bg-emerald-500 text-white'
                : showResult && isSelected ? 'border-red-500 bg-red-500 text-white'
                : isSelected ? 'border-red-500 bg-red-500 text-white'
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

function ModeSelect({ onSelect }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
      <div className="text-4xl mb-3">🧠</div>
      <h2 className="text-lg font-extrabold text-gray-900 mb-1">Pytania egzaminacyjne KPP</h2>
      <p className="text-sm text-gray-400 mb-8">277 pytań z zakresu Kwalifikowanej Pierwszej Pomocy</p>
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <button
          onClick={() => onSelect('nauka')}
          className="flex flex-col items-center gap-3 border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-2xl p-6 transition-colors"
        >
          <span className="text-3xl">📖</span>
          <div>
            <div className="font-bold text-gray-900 text-sm mb-1">Nauka</div>
            <div className="text-xs text-gray-500">Przeglądaj wszystkie 277 pytań z natychmiastową informacją zwrotną</div>
          </div>
        </button>
        <button
          onClick={() => onSelect('egzamin')}
          className="flex flex-col items-center gap-3 border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-2xl p-6 transition-colors"
        >
          <span className="text-3xl">📝</span>
          <div>
            <div className="font-bold text-gray-900 text-sm mb-1">Egzamin</div>
            <div className="text-xs text-gray-500">{EXAM_COUNT} losowych pytań – wynik i odpowiedzi na końcu</div>
          </div>
        </button>
      </div>
    </div>
  )
}

function ResultsView({ questions, answers, onRetry, onBack }) {
  const correct = questions.filter(q => answers[q.nr] === q.correct).length
  const total = questions.length
  const pct = Math.round((correct / total) * 100)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-6 text-center border-b border-gray-100 bg-gray-50">
        <div className="text-4xl mb-3">{pct >= 75 ? '🎉' : '📋'}</div>
        <h2 className="text-xl font-extrabold text-gray-900 mb-1">Wynik egzaminu</h2>
        <div className="text-4xl font-black mt-4 mb-1" style={{ color: pct >= 75 ? '#059669' : '#dc2626' }}>
          {correct} / {total}
        </div>
        <div className="text-lg font-bold text-gray-500">{pct}%</div>
      </div>

      <div className="px-6 py-6 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Przegląd odpowiedzi</p>
        {questions.map((q, idx) => {
          const userAns = answers[q.nr]
          const isOk = userAns === q.correct
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
                  const isUserOpt = l === userAns
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
        <button
          onClick={onRetry}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
        >
          Spróbuj ponownie
        </button>
        <button
          onClick={onBack}
          className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors"
        >
          Zmień tryb
        </button>
      </div>
    </div>
  )
}

export default function QuizPanel() {
  const [mode, setMode] = useState(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showResult, setShowResult] = useState(false)
  const [finished, setFinished] = useState(false)

  const questions = useMemo(() => {
    if (!mode) return []
    if (mode === 'egzamin') return shuffle(kppQuestions).slice(0, EXAM_COUNT)
    return kppQuestions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sessionKey])

  function startMode(m) {
    setMode(m)
    setSessionKey(k => k + 1)
    setCurrentIndex(0)
    setAnswers({})
    setShowResult(false)
    setFinished(false)
  }

  function handleAnswer(letter) {
    const q = questions[currentIndex]
    setAnswers(prev => ({ ...prev, [q.nr]: letter }))
    if (mode === 'nauka') setShowResult(true)
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true)
    } else {
      setCurrentIndex(i => i + 1)
      setShowResult(false)
    }
  }

  function handleSubmitExam() {
    setFinished(true)
  }

  if (!mode) return <ModeSelect onSelect={startMode} />

  if (finished) {
    return (
      <ResultsView
        questions={questions}
        answers={answers}
        onRetry={() => startMode(mode)}
        onBack={() => setMode(null)}
      />
    )
  }

  const question = questions[currentIndex]
  const userAnswer = answers[question.nr]
  const answeredCount = Object.keys(answers).length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4">
        <button
          onClick={() => setMode(null)}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
        >
          ← Zmień tryb
        </button>
        <div className="text-xs text-gray-500 font-semibold">
          {mode === 'nauka' ? (
            <span>{currentIndex + 1} / {questions.length}</span>
          ) : (
            <span>Pytanie {currentIndex + 1} / {questions.length} · Odpowiedziano: {answeredCount}</span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 pt-3">
        <ProgressBar current={currentIndex + 1} total={questions.length} />
        <div className="flex justify-between text-xs text-gray-300 mb-4">
          <span>{mode === 'nauka' ? 'Nauka' : 'Egzamin próbny'}</span>
          <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
        </div>
      </div>

      {/* Question */}
      <div className="px-5 pb-5">
        <QuestionView
          question={question}
          mode={mode}
          onAnswer={handleAnswer}
          answer={userAnswer}
          showResult={showResult}
        />

        {/* Feedback / Next */}
        {mode === 'nauka' && showResult && (
          <div className={`mt-4 px-4 py-3 rounded-xl ${userAnswer === question.correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm font-semibold ${userAnswer === question.correct ? 'text-emerald-700' : 'text-red-700'}`}>
              {userAnswer === question.correct ? '✓ Poprawna odpowiedź!' : `✗ Niepoprawna. Prawidłowa odpowiedź: ${question.correct}`}
            </p>
          </div>
        )}

        {mode === 'nauka' && showResult && (
          <button
            onClick={handleNext}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            {currentIndex + 1 >= questions.length ? 'Zakończ' : 'Następne pytanie →'}
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
                onClick={handleSubmitExam}
                disabled={answeredCount < questions.length}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                {answeredCount < questions.length ? `Odpowiedz na wszystkie (brakuje ${questions.length - answeredCount})` : 'Zakończ egzamin i sprawdź wynik'}
              </button>
            )}
            {currentIndex > 0 && (
              <button
                onClick={() => { setCurrentIndex(i => i - 1); setShowResult(false) }}
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
