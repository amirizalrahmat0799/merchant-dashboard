import { ArrowUpRight, Clock, Percent, TrendingUp, Undo2, Wallet } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, ErrorBanner, PageHeader, Spinner, StatusBadge } from '@/components/ui'
import { useSession } from '@/lib/auth-context'
import { formatDateTime, formatMoney } from '@/lib/money'
import { useLedger, usePayments } from '@/lib/queries'
import { computeKpis, dailyVolume } from '@/lib/stats'

export function OverviewPage() {
  const { merchant } = useSession()
  // The overview looks at the latest 100 payments; the Payments page pages through everything.
  const payments = usePayments(0, 100)
  const ledger = useLedger()

  const kpis = useMemo(
    () => computeKpis(payments.data?.items ?? [], ledger.data ?? []),
    [payments.data, ledger.data],
  )
  const series = useMemo(() => dailyVolume(ledger.data ?? []), [ledger.data])

  const loading = payments.isPending || ledger.isPending
  const error = payments.error ?? ledger.error

  return (
    <>
      <PageHeader
        title={`Good day, ${merchant.name}`}
        subtitle="Here's how your business is doing."
        actions={
          <Link to="/payments/new" className="btn-primary">
            New payment
          </Link>
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorBanner error={error} onRetry={() => { void payments.refetch(); void ledger.refetch() }} />
        </div>
      )}

      <section aria-label="Key figures" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<TrendingUp />} label="Gross volume" value={formatMoney(kpis.grossVolume)} loading={loading} />
        <Kpi icon={<Wallet />} label="Net after refunds & fees" value={formatMoney(kpis.net)} loading={loading} />
        <Kpi icon={<Undo2 />} label="Refunded" value={formatMoney(kpis.refunded)} loading={loading} />
        <Kpi
          icon={<Percent />}
          label="Approval rate"
          value={`${(kpis.approvalRate * 100).toFixed(1)}%`}
          hint={`${kpis.paymentCount} payments`}
          loading={loading}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2" aria-labelledby="volume-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="volume-title" className="font-semibold">
              Volume, last 14 days
            </h2>
            <div className="flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-accent" /> Captured
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warn" /> Refunded
              </span>
            </div>
          </div>
          <div className="h-64">
            {loading ? (
              <div className="grid h-full place-items-center">
                <Spinner />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="capturedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis
                    tick={{ fill: 'var(--muted)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v: number) => `RM${Math.round(v / 100)}`}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--line)' }}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      color: 'var(--fg)',
                      fontSize: 13,
                    }}
                    formatter={(value, name) => [formatMoney(Number(value)), name === 'captured' ? 'Captured' : 'Refunded']}
                  />
                  <Area type="monotone" dataKey="captured" stroke="var(--accent)" strokeWidth={2} fill="url(#capturedFill)" />
                  <Area type="monotone" dataKey="refunded" stroke="var(--warn)" strokeWidth={2} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card p-5" aria-labelledby="attention-title">
          <h2 id="attention-title" className="mb-4 font-semibold">
            Needs attention
          </h2>
          <div className="flex items-center gap-3 rounded-lg bg-info/10 p-4">
            <Clock className="size-5 text-info" aria-hidden />
            <div>
              <p className="text-2xl font-bold">{loading ? '–' : kpis.awaitingCapture}</p>
              <p className="text-sm text-muted">authorized, awaiting capture</p>
            </div>
          </div>
          <Link to="/payments?status=AUTHORIZED" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            Review authorizations <ArrowUpRight className="size-4" aria-hidden />
          </Link>
          <div className="mt-6 border-t border-line pt-4 text-sm">
            <p className="text-muted">Processing fees paid</p>
            <p className="text-lg font-semibold">{formatMoney(kpis.fees)}</p>
            <p className="text-xs text-muted">at {(merchant.feeBps / 100).toFixed(2)}% per capture</p>
          </div>
        </section>
      </div>

      <section className="card mt-6" aria-labelledby="recent-title">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 id="recent-title" className="font-semibold">
            Recent payments
          </h2>
          <Link to="/payments" className="text-sm font-semibold text-accent hover:underline">
            View all
          </Link>
        </div>
        {payments.data?.items.length === 0 ? (
          <EmptyState title="No payments yet">Create your first payment to see it here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {(payments.data?.items ?? []).slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link to={`/payments?id=${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.description ?? 'Payment'}</p>
                    <p className="text-xs text-muted">
                      {p.card.brand} •••• {p.card.last4} · {formatDateTime(p.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                  <p className="w-28 text-right font-mono text-sm">{formatMoney(p.amount, p.currency)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Kpi({ icon, label, value, hint, loading }: { icon: ReactNode; label: string; value: string; hint?: string; loading: boolean }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between text-muted">
        <p className="text-sm">{label}</p>
        <span className="[&>svg]:size-4" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{loading ? <Spinner /> : value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
