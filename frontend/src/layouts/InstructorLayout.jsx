import { useEffect, useState } from 'react'
import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import NotFound from '../pages/NotFound'
import { fetchMe } from '../api/instructor'

const NAV = [
  { to: '/prowadzacy/kursy', label: 'Kursy', icon: '📋' },
]

export default function InstructorLayout() {
  const navigate = useNavigate()
  const isAuthenticated = !!localStorage.getItem('access_token')
  const [me, setMe] = useState(null)

  useEffect(() => {
    if (isAuthenticated) fetchMe().then(setMe).catch(() => {})
  }, [isAuthenticated])

  function handleLogout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    navigate('/prowadzacy')
  }

  if (!isAuthenticated) return <Navigate to="/prowadzacy" replace />
  if (me?.role === 'admin') return <Navigate to="/admin" replace />
  if (me?.role === 'participant') return <NotFound />

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <span className="text-xl font-extrabold text-gray-900 tracking-tight">Mc Med</span>
          <p className="text-xs text-gray-400 mt-0.5">Panel prowadzącego</p>
          {me?.first_name && <p className="text-sm font-medium text-gray-700 mt-2">{me.first_name}</p>}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full text-xs font-semibold text-orange-500 border-2 border-orange-400 px-3 py-1.5 rounded-lg transition-colors hover:text-orange-600 hover:border-orange-500 hover:bg-orange-50 active:bg-orange-100 active:scale-95"
          >
            Wyloguj
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
