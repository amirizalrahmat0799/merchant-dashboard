import { useState } from 'react'
import { EmptyState, ErrorBanner, PageHeader, Spinner } from '@/components/ui'
import { formatDate, formatDateTime, formatMoney } from '@/lib/money'
import { useLedger, useRunSettlement, useSettlements } from '@/lib/queries'

const today = () => new Date().toISOString().slice(0, 10)

export function SettlementsPage() {
  const settlements = useSettlements()
  const ledger = useLedger()
  const run = useRunSettlement()
  const [date, setDate] = useState(today)

  const unsettled = (ledger.data ?? []).filter((e) => e.settlementId === null)
  const unsettledNet = unsettled.reduce((s, e) => s + (e.entryType === 'CAPTURE' ? e.amount : -e.amount) - e.fee, 0)

  return (
    <>
      <PageHeader title="Settlements" subtitle="Payouts are calculated nightly from the ledger by a Spring Batch job." />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5" aria-labelledby="pending-title">
          <h2 id="pending-title" className="text-sm text-muted">
            Pending payout
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {ledger.isPending ? <Spinner /> : formatMoney(unsettledNet)}
          </p>
          <p className="mt-1 text-xs text-muted">{unsettled.length} unsettled ledger entries</p>
        </section>

        <section className="card p-5 lg:col-span-2" aria-labelledby="run-title">
          <h2 id="run-title" className="font-semibold">
            Run settlement
          </h2>
          <p className="mt-1 text-sm text-muted">
            Settles everything up to the end of the chosen day (UTC). Each date can only be settled once.
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              run.mutate(date)
            }}
          >
            <div>
              <label htmlFor="settle-date" className="label">
                Settlement date
              </label>
              <input id="settle-date" type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={run.isPending || !date}>
              {run.isPending && <Spinner />} Run now
            </button>
          </form>
          <div className="mt-3" aria-live="polite">
            {run.error && <ErrorBanner error={run.error} />}
            {run.data && (
              <p className="text-sm text-accent">
                Settlement for {run.data.settlementDate} finished: {run.data.status.toLowerCase()}.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="card mb-6 overflow-hidden" aria-labelledby="history-title">
        <h2 id="history-title" className="p-5 pb-3 font-semibold">
          Settlement history
        </h2>
        {settlements.error && (
          <div className="px-5 pb-4">
            <ErrorBanner error={settlements.error} onRetry={() => void settlements.refetch()} />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-y border-line bg-surface-2">
              <tr>
                <th className="th">Date</th>
                <th className="th text-right">Captured</th>
                <th className="th text-right">Refunded</th>
                <th className="th text-right">Fees</th>
                <th className="th text-right">Net payout</th>
                <th className="th text-right">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(settlements.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="td">{formatDate(s.settlementDate)}</td>
                  <td className="td text-right font-mono">{formatMoney(s.grossCaptured, s.currency)}</td>
                  <td className="td text-right font-mono text-muted">{formatMoney(s.grossRefunded, s.currency)}</td>
                  <td className="td text-right font-mono text-muted">{formatMoney(s.fees, s.currency)}</td>
                  <td className={`td text-right font-mono font-semibold ${s.netAmount < 0 ? 'text-danger' : ''}`}>
                    {formatMoney(s.netAmount, s.currency)}
                  </td>
                  <td className="td text-right text-muted">{s.entryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {settlements.isPending && (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        )}
        {settlements.data?.length === 0 && <EmptyState title="No settlements yet">Run your first settlement above.</EmptyState>}
      </section>

      <section className="card overflow-hidden" aria-labelledby="ledger-title">
        <h2 id="ledger-title" className="p-5 pb-3 font-semibold">
          Ledger
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-y border-line bg-surface-2">
              <tr>
                <th className="th">When</th>
                <th className="th">Type</th>
                <th className="th">Payment</th>
                <th className="th text-right">Amount</th>
                <th className="th text-right">Fee</th>
                <th className="th">Settled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(ledger.data ?? []).slice(0, 25).map((e) => (
                <tr key={e.id}>
                  <td className="td whitespace-nowrap text-muted">{formatDateTime(e.occurredAt)}</td>
                  <td className="td">
                    <span className={e.entryType === 'CAPTURE' ? 'text-accent' : 'text-warn'}>{e.entryType.toLowerCase()}</span>
                  </td>
                  <td className="td font-mono text-xs text-muted">{e.paymentId.slice(0, 8)}</td>
                  <td className="td text-right font-mono">
                    {e.entryType === 'REFUND' ? '−' : ''}
                    {formatMoney(e.amount, e.currency)}
                  </td>
                  <td className="td text-right font-mono text-muted">{formatMoney(e.fee, e.currency)}</td>
                  <td className="td text-muted">{e.settlementId ? 'Yes' : 'Pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ledger.data?.length === 0 && <EmptyState title="Ledger is empty">Captured payments appear here via Kafka.</EmptyState>}
      </section>
    </>
  )
}
