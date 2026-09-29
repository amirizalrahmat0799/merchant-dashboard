import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { EmptyState, ErrorBanner, PageHeader, Spinner, StatusBadge } from '@/components/ui'
import { formatDateTime, formatMoney } from '@/lib/money'
import { usePayments } from '@/lib/queries'
import type { PaymentStatus } from '@/lib/types'
import { PaymentDetail } from './PaymentDetail'

const PAGE_SIZE = 15
const FILTER_WINDOW = 100
const STATUSES: (PaymentStatus | 'ALL')[] = ['ALL', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED', 'DECLINED']

export function PaymentsPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'ALL') as PaymentStatus | 'ALL'
  const page = Number(params.get('page') ?? 0)
  const selectedId = params.get('id')
  const filtering = status !== 'ALL'

  // The API pages by date only, so a status filter is applied to the latest 100 payments.
  const query = usePayments(filtering ? 0 : page, filtering ? FILTER_WINDOW : PAGE_SIZE)
  const rows = filtering ? (query.data?.items ?? []).filter((p) => p.status === status) : (query.data?.items ?? [])

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next)
  }

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={query.data ? `${query.data.totalItems} payments in total` : undefined}
        actions={query.isFetching && !query.isPending ? <Spinner className="text-muted" /> : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => update({ status: s === 'ALL' ? null : s, page: null })}
            className={
              status === s
                ? 'btn px-3 py-1.5 text-xs bg-accent text-accent-fg'
                : 'btn px-3 py-1.5 text-xs border border-line bg-surface text-muted hover:text-fg'
            }
          >
            {s === 'ALL' ? 'All' : s.replace('_', ' ').toLowerCase()}
          </button>
        ))}
      </div>

      {query.error && (
        <div className="mb-4">
          <ErrorBanner error={query.error} onRetry={() => void query.refetch()} />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-line bg-surface-2">
              <tr>
                <th className="th">Payment</th>
                <th className="th">Card</th>
                <th className="th">Status</th>
                <th className="th text-right">Amount</th>
                <th className="th text-right">Refunded</th>
                <th className="th">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {query.isPending ? (
                <tr>
                  <td colSpan={6} className="td py-12 text-center">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => update({ id: p.id })}
                    className="cursor-pointer hover:bg-surface-2"
                  >
                    <td className="td">
                      <button
                        type="button"
                        className="text-left font-medium hover:text-accent"
                        onClick={(e) => {
                          e.stopPropagation()
                          update({ id: p.id })
                        }}
                      >
                        {p.description ?? 'Payment'}
                      </button>
                      <p className="font-mono text-[11px] text-muted">{p.id.slice(0, 8)}</p>
                    </td>
                    <td className="td text-muted">
                      {p.card.brand} •••• {p.card.last4}
                    </td>
                    <td className="td">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="td text-right font-mono">{formatMoney(p.amount, p.currency)}</td>
                    <td className="td text-right font-mono text-muted">
                      {p.refundedAmount > 0 ? formatMoney(p.refundedAmount, p.currency) : '–'}
                    </td>
                    <td className="td whitespace-nowrap text-muted">{formatDateTime(p.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!query.isPending && rows.length === 0 && (
          <EmptyState title="No payments found">
            {filtering ? 'Nothing with this status in your latest 100 payments.' : 'Create a payment to get started.'}
          </EmptyState>
        )}

        {!filtering && query.data && query.data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <p className="text-muted">
              Page {page + 1} of {query.data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-2.5 py-1.5"
                disabled={page === 0}
                onClick={() => update({ page: String(page - 1) })}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                className="btn-secondary px-2.5 py-1.5"
                disabled={page + 1 >= query.data.totalPages}
                onClick={() => update({ page: String(page + 1) })}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <PaymentDetail paymentId={selectedId} onClose={() => update({ id: null })} />
    </>
  )
}
