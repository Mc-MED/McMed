import { Outlet, NavLink, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/admin/courses',      label: 'Kursy',        icon: '📋' },
  { to: '/admin/participants', label: 'Uczestnicy',   icon: '👥' },
  { to: '/admin/instructors',  label: 'Instruktorzy', icon: '🚑' },
]

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <span className="text-xl font-extrabold text-gray-900 tracking-tight">Mc Med</span>
          <p className="text-xs text-gray-400 mt-0.5">Panel zarządzania</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
          <a href="/" className="text-xs text-gray-400 hover:text-red-600 transition-colors">
            ← Wróć na stronę główną
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
