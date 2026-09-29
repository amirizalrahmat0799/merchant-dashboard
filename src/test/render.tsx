import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/App'
import { AuthProvider } from '@/lib/auth'
import { DEMO_API_KEY } from '@/lib/demo'
import { createQueryClient } from '@/lib/query-client'
import { db } from './server'

/** Renders the real route tree at `path`, optionally already signed in as the demo merchant. */
export function renderApp(path: string, { signedIn = true } = {}) {
  if (signedIn) {
    const merchant = db.merchants.get(DEMO_API_KEY)!
    const { apiKey: _key, ...publicMerchant } = merchant
    void _key
    sessionStorage.setItem('pgs.session', JSON.stringify({ apiKey: DEMO_API_KEY, merchant: publicMerchant }))
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false, refetchInterval: false } })
  const user = userEvent.setup()
  const utils = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { user, router, ...utils }
}
