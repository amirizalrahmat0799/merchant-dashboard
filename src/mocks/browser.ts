import { setupWorker } from 'msw/browser'
import { createHandlers } from './handlers'

/** Demo mode: the whole gateway runs in a service worker, so the dashboard works on static hosting. */
export async function startDemoBackend() {
  const worker = setupWorker(...createHandlers())
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}
