/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

/**
 * In development the dashboard talks to the four gateway services through Vite's proxy,
 * so no CORS configuration is needed on the Spring Boot side. In production nginx does
 * the same job (see nginx/default.conf.template).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gateway = env.GATEWAY_HOST ?? 'http://localhost'

  const proxy = (port: number) => ({
    target: `${gateway}:${port}`,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/[a-z]+-api/, ''),
  })

  return {
    base: env.VITE_BASE_PATH ?? '/',
    // `--mode demo` runs the app against the simulated gateway (no backend needed).
    define: mode === 'demo' ? { 'import.meta.env.VITE_DEMO_MODE': JSON.stringify('true') } : {},
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/merchant-api': proxy(8081),
        '/payment-api': proxy(8082),
        '/token-api': proxy(8083),
        '/settlement-api': proxy(8084),
        '/assistant-api': proxy(8085),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
