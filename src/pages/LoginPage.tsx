import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CreditCard, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { CopyButton, ErrorBanner, Spinner } from '@/components/ui'
import { ThemeToggle } from '@/components/ThemeToggle'
import { merchantApi } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { DEMO_API_KEY, DEMO_MODE } from '@/lib/demo'
import type { Merchant } from '@/lib/types'

const loginSchema = z.object({
  apiKey: z.string().trim().regex(/^sk_test_\S{8,}$/, 'API keys start with sk_test_'),
})

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your business name').max(120),
  email: z.email('Enter a valid email'),
  feeBps: z.coerce.number<number>().int().min(0).max(1000),
})

type LoginForm = z.infer<typeof loginSchema>
type SignupForm = z.infer<typeof signupSchema>

export function LoginPage() {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [created, setCreated] = useState<Merchant | null>(null)

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { apiKey: '' } })
  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', feeBps: 250 },
  })

  const loginMutation = useMutation({
    mutationFn: (apiKey: string) => login(apiKey),
    onSuccess: () => navigate('/', { replace: true }),
  })

  const signupMutation = useMutation({
    mutationFn: (input: SignupForm) => merchantApi.onboard(input),
    onSuccess: (merchant) => setCreated(merchant),
  })

  if (session) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-accent text-accent-fg">
            <CreditCard className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Merchant Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Payment Gateway Simulator</p>
        </div>

        <div className="card p-6">
          {created ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Welcome, {created.name}</h2>
              <p className="text-sm text-muted">
                Here is your API key. <strong className="text-fg">It is shown only once</strong>, so store it somewhere safe.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-3">
                <code className="flex-1 break-all font-mono text-xs">{created.apiKey}</code>
                <CopyButton value={created.apiKey ?? ''} label="Copy API key" />
              </div>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={loginMutation.isPending}
                onClick={() => loginMutation.mutate(created.apiKey ?? '')}
              >
                {loginMutation.isPending && <Spinner />} Continue to dashboard
              </button>
            </div>
          ) : mode === 'login' ? (
            <form onSubmit={loginForm.handleSubmit((v) => loginMutation.mutate(v.apiKey))} noValidate className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="label">
                  API key
                </label>
                <div className="relative">
                  <KeyRound aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                  <input
                    id="apiKey"
                    type="password"
                    autoComplete="off"
                    placeholder="sk_test_…"
                    className="input pl-9 font-mono"
                    aria-invalid={!!loginForm.formState.errors.apiKey}
                    {...loginForm.register('apiKey')}
                  />
                </div>
                {loginForm.formState.errors.apiKey && (
                  <p className="field-error">{loginForm.formState.errors.apiKey.message}</p>
                )}
              </div>

              {loginMutation.error && <ErrorBanner error={loginMutation.error} />}

              <button type="submit" className="btn-primary w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending && <Spinner />} Sign in
              </button>

              {DEMO_MODE && (
                <button
                  type="button"
                  className="btn-secondary w-full"
                  disabled={loginMutation.isPending}
                  onClick={() => loginMutation.mutate(DEMO_API_KEY)}
                >
                  Try the demo merchant
                </button>
              )}

              <p className="text-center text-sm text-muted">
                New merchant?{' '}
                <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setMode('signup')}>
                  Create a sandbox account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={signupForm.handleSubmit((v) => signupMutation.mutate(v))} noValidate className="space-y-4">
              <div>
                <label htmlFor="name" className="label">
                  Business name
                </label>
                <input id="name" className="input" {...signupForm.register('name')} />
                {signupForm.formState.errors.name && (
                  <p className="field-error">{signupForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input id="email" type="email" className="input" {...signupForm.register('email')} />
                {signupForm.formState.errors.email && (
                  <p className="field-error">{signupForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="feeBps" className="label">
                  Processing fee (basis points)
                </label>
                <input id="feeBps" type="number" className="input" {...signupForm.register('feeBps')} />
                <p className="mt-1 text-xs text-muted">250 bps = 2.50% per captured payment</p>
                {signupForm.formState.errors.feeBps && (
                  <p className="field-error">{signupForm.formState.errors.feeBps.message}</p>
                )}
              </div>

              {signupMutation.error && <ErrorBanner error={signupMutation.error} />}

              <button type="submit" className="btn-primary w-full" disabled={signupMutation.isPending}>
                {signupMutation.isPending && <Spinner />} Create account
              </button>
              <p className="text-center text-sm text-muted">
                Already have a key?{' '}
                <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setMode('login')}>
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
