export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center">
      <p className="text-6xl font-extrabold text-red-600 mb-4">404</p>
      <p className="text-gray-600 mb-6">Strona nie istnieje</p>
      {/* Strona główna (landing) nie jest częścią aplikacji React – pełne przejście zamiast <Link> */}
      <a href="https://mcmed.pl" className="text-red-600 hover:underline font-medium">
        ← Wróć na stronę główną
      </a>
    </div>
  )
}
