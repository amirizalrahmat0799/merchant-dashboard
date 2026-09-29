import { clsx } from 'clsx'
import { AlertTriangle, Check, Copy, Inbox, LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PaymentStatus } from '@/lib/types'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={clsx('size-4 animate-spin', className)} />
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STATUS_STYLES: Record<PaymentStatus, string> = {
  AUTHORIZED: 'bg-info/10 text-info',
  CAPTURED: 'bg-success/10 text-success',
  PARTIALLY_REFUNDED: 'bg-warn/10 text-warn',
  REFUNDED: 'bg-warn/10 text-warn',
  VOIDED: 'bg-surface-2 text-muted',
  DECLINED: 'bg-danger/10 text-danger',
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium',
        STATUS_STYLES[status],
      )}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export function ErrorBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong'
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
      <p className="flex-1 text-fg">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold text-danger hover:underline">
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <Inbox aria-hidden className="mb-3 size-8 text-muted" />
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn-secondary px-2.5 py-1.5"
      aria-label={copied ? 'Copied' : label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </button>
  )
}

/** Accessible modal built on the native <dialog> element (focus trap and Esc for free). */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="m-auto w-[min(92vw,440px)] rounded-xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/50"
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-2">
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
