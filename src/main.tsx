import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

async function bootstrap() {
  // Compared inline (not via DEMO_MODE) so the bundler can drop the mock backend from real builds.
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    // Loaded lazily so the mock backend is never part of the real build's main bundle.
    const { startDemoBackend } = await import('./mocks/browser')
    await startDemoBackend()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
