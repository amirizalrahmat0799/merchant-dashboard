import { useState, type FormEvent, type ReactNode } from 'react'
import { ErrorBanner, Modal, Spinner, StatusBadge } from '@/components/ui'
import { formatDateTime, formatMoney, toMinor } from '@/lib/money'
import { useCapture, usePayment, useRefund, useRefunds, useVoid } from '@/lib/queries'
import type { Payment } from '@/lib/types'

export function PaymentDetail({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const payment = usePayment(paymentId)
  const refunds = useRefunds(paymentId)

  return (
    <Modal open={paymentId !== null} onClose={onClose} title="Payment details">
      {payment.isPending ? (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      ) : payment.error ? (
        <ErrorBanner error={payment.error} />
      ) : payment.data ? (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-bold tracking-tight">{formatMoney(payment.data.amount, payment.data.currency)}</p>
              <p className="text-sm text-muted">{payment.data.description ?? 'Payment'}</p>
            </div>
            <StatusBadge status={payment.data.status} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-surface-2 p-4 text-sm">
            <Row label="Card">
              {payment.data.card.brand} •••• {payment.data.card.last4}
            </Row>
            <Row label={payment.data.declineReason ? 'Decline reason' : 'Auth code'}>
              <span className="font-mono">{payment.data.declineReason ?? payment.data.authCode ?? '–'}</span>
            </Row>
            <Row label="Captured">{formatMoney(payment.data.capturedAmount, payment.data.currency)}</Row>
            <Row label="Refundable">{formatMoney(payment.data.refundableAmount, payment.data.currency)}</Row>
            <Row label="Created">{formatDateTime(payment.data.createdAt)}</Row>
            <Row label="ID">
              <span className="font-mono text-xs break-all">{payment.data.id}</span>
            </Row>
          </dl>

          <Actions key={payment.data.id} payment={payment.data} />

          {(refunds.data?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Refunds</h3>
              <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                {refunds.data!.map((r) => (
                  <li key={r.id} className="flex justify-between px-3 py-2">
                    <span className="text-muted">{formatDateTime(r.createdAt)}</span>
                    <span className="font-mono">−{formatMoney(r.amount, payment.data!.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

/** Only the actions that are valid for the current status are shown (mirrors the backend state machine). */
function Actions({ payment }: { payment: Payment }) {
  const capture = useCapture()
  const voidMutation = useVoid()
  const refund = useRefund()
  const [amount, setAmount] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)

  const error = capture.error ?? voidMutation.error ?? refund.error
  const busy = capture.isPending || voidMutation.isPending || refund.isPending

  const submit = (e: FormEvent, kind: 'capture' | 'refund') => {
    e.preventDefault()
    setInputError(null)
    const minor = amount.trim() === '' ? undefined : toMinor(amount)
    if (minor !== undefined && (Number.isNaN(minor) || minor <= 0)) {
      setInputError('Enter an amount like 12.50')
      return
    }
    if (kind === 'capture') {
      capture.mutate({ id: payment.id, amount: minor }, { onSuccess: () => setAmount('') })
    } else {
      refund.mutate({ id: payment.id, amount: minor ?? payment.refundableAmount }, { onSuccess: () => setAmount('') })
    }
  }

  if (payment.status === 'AUTHORIZED') {
    return (
      <form onSubmit={(e) => submit(e, 'capture')} className="space-y-3" noValidate>
        <AmountInput
          id="capture-amount"
          label="Capture amount"
          hint={`Leave empty to capture the full ${formatMoney(payment.amount, payment.currency)}`}
          value={amount}
          onChange={setAmount}
          error={inputError}
        />
        {error && <ErrorBanner error={error} />}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            {capture.isPending && <Spinner />} Capture
          </button>
          <button type="button" className="btn-danger" disabled={busy} onClick={() => voidMutation.mutate(payment.id)}>
            {voidMutation.isPending && <Spinner />} Void
          </button>
        </div>
      </form>
    )
  }

  if (payment.status === 'CAPTURED' || payment.status === 'PARTIALLY_REFUNDED') {
    return (
      <form onSubmit={(e) => submit(e, 'refund')} className="space-y-3" noValidate>
        <AmountInput
          id="refund-amount"
          label="Refund amount"
          hint={`Leave empty to refund the remaining ${formatMoney(payment.refundableAmount, payment.currency)}`}
          value={amount}
          onChange={setAmount}
          error={inputError}
        />
        {error && <ErrorBanner error={error} />}
        <button type="submit" className="btn-secondary w-full" disabled={busy}>
          {refund.isPending && <Spinner />} Refund
        </button>
      </form>
    )
  }

  return null
}

function AmountInput(props: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  error: string | null
}) {
  return (
    <div>
      <label htmlFor={props.id} className="label">
        {props.label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">RM</span>
        <input
          id={props.id}
          inputMode="decimal"
          placeholder="0.00"
          className="input pl-10 font-mono"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={!!props.error}
        />
      </div>
      <p className="mt-1 text-xs text-muted">{props.hint}</p>
      {props.error && <p className="field-error">{props.error}</p>}
    </div>
  )
}
