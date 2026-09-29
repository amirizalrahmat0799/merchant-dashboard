import { clsx } from 'clsx'
import { CreditCard, Landmark, LayoutDashboard, LogOut, Menu, Plus, Settings, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth, useSession } from '@/lib/auth-context'
import { DEMO_MODE } from '@/lib/demo'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/payments/new', label: 'New payment', icon: Plus },
  { to: '/settlements', label: 'Settlements', icon: Landmark },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout() {
  const { logout } = useAuth()
  const { merchant } = useSession()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)

  // Close the mobile menu after navigating.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setOpen(false)
  }

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg">
          <CreditCard className="size-4" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold">PGS Dashboard</p>
          <p className="font-mono text-[11px] text-muted">{DEMO_MODE ? 'demo mode' : 'sandbox'}</p>
        </div>
      </div>

      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? to === '/payments'}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}

      <div className="mt-auto border-t border-line pt-4">
        <div className="mb-3 px-2">
          <p className="truncate text-sm font-semibold">{merchant.name}</p>
          <p className="truncate text-xs text-muted">{merchant.email}</p>
        </div>
        <div className="flex items-center gap-2 px-1">
          <ThemeToggle />
          <button type="button" onClick={logout} className="btn-secondary flex-1 py-1.5">
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{sidebar}</aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="text-sm font-bold">PGS Dashboard</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="btn-secondary px-2.5 py-1.5"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-20 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-line bg-surface pt-14">{sidebar}</aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        {DEMO_MODE && (
          <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-fg">
            You're viewing a <strong>demo</strong>: the gateway is simulated in your browser, so data resets when you reload.
          </p>
        )}
        <Outlet />
      </main>
    </div>
  )
}
