import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createBrowserRouter, createHashRouter, Link, Navigate, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { Layout } from '@/components/Layout'
import { AuthProvider } from '@/lib/auth'
import { useAuth } from '@/lib/auth-context'
import { DEMO_MODE } from '@/lib/demo'
import { LoginPage } from '@/pages/LoginPage'
import { createQueryClient, UNAUTHORIZED_EVENT } from '@/lib/query-client'
import { Spinner } from '@/components/ui'

// Pages are code-split so the charting library only loads when the overview is opened.
const OverviewPage = lazy(() => import('@/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })))
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })))
const NewPaymentPage = lazy(() => import('@/pages/NewPaymentPage').then((m) => ({ default: m.NewPaymentPage })))
const SettlementsPage = lazy(() => import('@/pages/SettlementsPage').then((m) => ({ default: m.SettlementsPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const page = (node: ReactNode) => (
  <Suspense fallback={<div className="grid place-items-center py-20"><Spinner /></div>}>{node}</Suspense>
)

function RequireAuth() {
  const { session, logout } = useAuth()
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout)
  }, [logout])
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <Link to="/" className="btn-primary mt-6">
        Back to overview
      </Link>
    </div>
  )
}

// Exported for tests, which mount the same route tree in a memory router.
// oxlint-disable-next-line react/only-export-components
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: page(<OverviewPage />) },
          { path: 'payments', element: page(<PaymentsPage />) },
          { path: 'payments/new', element: page(<NewPaymentPage />) },
          { path: 'settlements', element: page(<SettlementsPage />) },
          { path: 'settings', element: page(<SettingsPage />) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]

export function App() {
  const [queryClient] = useState(createQueryClient)
  // The static demo on GitHub Pages can't rewrite deep links to index.html, so it uses hash URLs.
  const [router] = useState(() =>
    DEMO_MODE ? createHashRouter(routes) : createBrowserRouter(routes, { basename: import.meta.env.BASE_URL }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
