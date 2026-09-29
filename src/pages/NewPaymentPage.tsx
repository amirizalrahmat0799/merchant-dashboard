import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CircleCheck, CircleX } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { ErrorBanner, PageHeader, Spinner, StatusBadge } from '@/components/ui'
import { tokenApi } from '@/lib/api'
import { formatMoney, toMinor } from '@/lib/money'
import { useCreatePayment } from '@/lib/queries'
import type { Payment } from '@/lib/types'

const TEST_CARDS = [
  { pan: '4242 4242 4242 4242', label: 'Visa · approved' },
  { pan: '5555 5555 5555 4444', label: 'Mastercard · approved' },
  { pan: '4000 0000 0000 0002', label: 'Declined: card_declined' },
  { pan: '4000 0000 0000 9995', label: 'Declined: insufficient_funds' },
]

const schema = z.object({
  amount: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(toMinor(v)) && toMinor(v) > 0, 'Enter an amount like 25.00'),
  description: z.string().trim().max(255).optional(),
  pan: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{12,19}$/, 'Card number must be 12–19 digits')),
  expiry: z.string().trim().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY'),
  cardholderName: z.string().trim().max(120).optional(),
  capture: z.boolean(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function NewPaymentPage() {
  const createPayment = useCreatePayment()
  const [result, setResult] = useState<Payment | null>(null)

  /**
   * One idempotency key per checkout attempt. If the request times out and the user clicks
   * "Charge" again, the same key is sent, so the gateway returns the original payment instead
   * of charging twice. A new key is only generated after a payment is created.
   */
  const idempotencyKey = useRef(crypto.randomUUID())
  /** Reuse the token for the same card on a retry, so the retried request body is identical. */
  const tokenCache = useRef(new Map<string, string>())

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', description: '', pan: '', expiry: '12/30', cardholderName: '', capture: true },
  })
  const { errors } = form.formState

  const charge = useMutation({
    mutationFn: async (v: FormOutput) => {
      const [mm, yy] = v.expiry.split('/')
      const cacheKey = `${v.pan}|${v.expiry}`
      let cardToken = tokenCache.current.get(cacheKey)
      if (!cardToken) {
        const token = await tokenApi.tokenize({
          pan: v.pan,
          expiryMonth: Number(mm),
          expiryYear: 2000 + Number(yy),
          cardholderName: v.cardholderName || undefined,
        })
        cardToken = token.token
        tokenCache.current.set(cacheKey, cardToken)
      }
      return createPayment.mutateAsync({
        idempotencyKey: idempotencyKey.current,
        input: {
          amount: toMinor(v.amount),
          currency: 'MYR',
          cardToken,
          capture: v.capture,
          description: v.description || undefined,
        },
      })
    },
    onSuccess: (payment) => {
      setResult(payment)
      idempotencyKey.current = crypto.randomUUID()
      tokenCache.current.clear()
    },
  })

  if (result) {
    const approved = result.status !== 'DECLINED'
    return (
      <>
        <PageHeader title="New payment" />
        <div className="card mx-auto max-w-lg p-8 text-center">
          {approved ? (
            <CircleCheck className="mx-auto mb-3 size-12 text-accent" aria-hidden />
          ) : (
            <CircleX className="mx-auto mb-3 size-12 text-danger" aria-hidden />
          )}
          <h2 className="text-xl font-bold">{approved ? 'Payment approved' : 'Payment declined'}</h2>
          <p className="mt-1 text-3xl font-bold tracking-tight">{formatMoney(result.amount, result.currency)}</p>
          <div className="mt-3 flex justify-center">
            <StatusBadge status={result.status} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {result.card.brand} •••• {result.card.last4}
            {result.declineReason && (
              <>
                {' '}· reason <code className="font-mono">{result.declineReason}</code>
              </>
            )}
            {result.authCode && (
              <>
                {' '}· auth code <code className="font-mono">{result.authCode}</code>
              </>
            )}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setResult(null)
                form.reset({ ...form.getValues(), amount: '', description: '' })
              }}
            >
              New payment
            </button>
            <Link to={`/payments?id=${result.id}`} className="btn-secondary">
              View details
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="New payment" subtitle="A virtual terminal: charge a card directly from the dashboard." />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={form.handleSubmit((v) => charge.mutate(v))} noValidate className="card space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="amount" className="label">
                Amount (MYR)
              </label>
              <input id="amount" inputMode="decimal" placeholder="25.00" className="input font-mono" {...form.register('amount')} />
              {errors.amount && <p className="field-error">{errors.amount.message}</p>}
            </div>
            <div>
              <label htmlFor="description" className="label">
                Description <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="description" placeholder="Order #1001" className="input" {...form.register('description')} />
            </div>
          </div>

          <fieldset className="space-y-4 rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-semibold">Card</legend>
            <div>
              <label htmlFor="pan" className="label">
                Card number
              </label>
              <input id="pan" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" className="input font-mono" {...form.register('pan')} />
              {errors.pan && <p className="field-error">{errors.pan.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="expiry" className="label">
                  Expiry
                </label>
                <input id="expiry" placeholder="MM/YY" className="input font-mono" {...form.register('expiry')} />
                {errors.expiry && <p className="field-error">{errors.expiry.message}</p>}
              </div>
              <div>
                <label htmlFor="cardholderName" className="label">
                  Cardholder name <span className="font-normal text-muted">(optional)</span>
                </label>
                <input id="cardholderName" autoComplete="off" className="input" {...form.register('cardholderName')} />
              </div>
            </div>
            <p className="text-xs text-muted">
              The card number goes straight to the tokenization service. The payment service only ever sees the token.
            </p>
          </fieldset>

          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" {...form.register('capture')} />
            <span>
              <span className="font-medium">Capture immediately</span>
              <span className="block text-muted">Untick to only authorize, then capture or void later from Payments.</span>
            </span>
          </label>

          {charge.error && <ErrorBanner error={charge.error} />}

          <button type="submit" className="btn-primary w-full" disabled={charge.isPending}>
            {charge.isPending && <Spinner />} Charge card
          </button>
        </form>

        <aside className="card h-fit p-5">
          <h2 className="mb-3 text-sm font-semibold">Test cards</h2>
          <ul className="space-y-2">
            {TEST_CARDS.map((c) => (
              <li key={c.pan}>
                <button
                  type="button"
                  onClick={() => form.setValue('pan', c.pan, { shouldValidate: true })}
                  className="w-full rounded-lg border border-line p-3 text-left hover:border-accent hover:bg-surface-2"
                >
                  <p className="font-mono text-xs">{c.pan}</p>
                  <p className="mt-0.5 text-xs text-muted">{c.label}</p>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Amounts over RM 50,000 are declined with amount_limit_exceeded.</p>
        </aside>
      </div>
    </>
  )
}
