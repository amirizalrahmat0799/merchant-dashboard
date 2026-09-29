import { computeKpis, dailyVolume } from './stats'
import type { LedgerEntry, Payment } from './types'

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  id: crypto.randomUUID(),
  paymentId: 'p',
  merchantId: 'm',
  entryType: 'CAPTURE',
  amount: 10_000,
  currency: 'MYR',
  fee: 250,
  occurredAt: '2026-09-29T10:00:00Z',
  settlementId: null,
  ...over,
})

const payment = (status: Payment['status']) => ({ status }) as Payment

describe('computeKpis', () => {
  it('derives volume, refunds, fees and net from the ledger', () => {
    const kpis = computeKpis(
      [payment('CAPTURED'), payment('DECLINED'), payment('AUTHORIZED'), payment('REFUNDED')],
      [entry({}), entry({ amount: 5_000, fee: 125 }), entry({ entryType: 'REFUND', amount: 2_000, fee: 0 })],
    )

    expect(kpis.grossVolume).toBe(15_000)
    expect(kpis.refunded).toBe(2_000)
    expect(kpis.fees).toBe(375)
    expect(kpis.net).toBe(12_625)
    expect(kpis.approvalRate).toBe(0.75)
    expect(kpis.awaitingCapture).toBe(1)
  })

  it('handles an empty account', () => {
    expect(computeKpis([], []).approvalRate).toBe(0)
  })
})

describe('dailyVolume', () => {
  it('buckets by UTC day and includes empty days', () => {
    const points = dailyVolume(
      [entry({ occurredAt: '2026-09-29T23:59:00Z' }), entry({ entryType: 'REFUND', amount: 500, occurredAt: '2026-09-28T01:00:00Z' })],
      3,
      new Date('2026-09-29T12:00:00Z'),
    )

    expect(points.map((p) => p.date)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29'])
    expect(points[0]).toMatchObject({ captured: 0, refunded: 0 })
    expect(points[1]).toMatchObject({ captured: 0, refunded: 500 })
    expect(points[2]).toMatchObject({ captured: 10_000, refunded: 0 })
  })
})
