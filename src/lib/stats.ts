import type { LedgerEntry, Payment } from './types'

export interface Kpis {
  grossVolume: number
  refunded: number
  fees: number
  net: number
  approvalRate: number
  paymentCount: number
  awaitingCapture: number
}

/** Headline numbers. Money figures come from the ledger (what actually moved), counts from payments. */
export function computeKpis(payments: Payment[], ledger: LedgerEntry[]): Kpis {
  const grossVolume = ledger.filter((e) => e.entryType === 'CAPTURE').reduce((s, e) => s + e.amount, 0)
  const refunded = ledger.filter((e) => e.entryType === 'REFUND').reduce((s, e) => s + e.amount, 0)
  const fees = ledger.reduce((s, e) => s + e.fee, 0)
  const decided = payments.length
  const approved = payments.filter((p) => p.status !== 'DECLINED').length
  return {
    grossVolume,
    refunded,
    fees,
    net: grossVolume - refunded - fees,
    approvalRate: decided === 0 ? 0 : approved / decided,
    paymentCount: payments.length,
    awaitingCapture: payments.filter((p) => p.status === 'AUTHORIZED').length,
  }
}

export interface DailyPoint {
  date: string
  label: string
  captured: number
  refunded: number
}

/** Captured and refunded amounts per day for the last `days` days (UTC), including empty days. */
export function dailyVolume(ledger: LedgerEntry[], days = 14, now = new Date()): DailyPoint[] {
  const points = new Map<string, DailyPoint>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const key = d.toISOString().slice(0, 10)
    points.set(key, {
      date: key,
      label: d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      captured: 0,
      refunded: 0,
    })
  }
  for (const e of ledger) {
    const p = points.get(e.occurredAt.slice(0, 10))
    if (!p) continue
    if (e.entryType === 'CAPTURE') p.captured += e.amount
    else p.refunded += e.amount
  }
  return [...points.values()]
}
