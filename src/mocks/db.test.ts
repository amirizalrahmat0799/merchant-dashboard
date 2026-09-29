import { DEMO_API_KEY } from '@/lib/demo'
import * as ops from './db'

/** The demo backend must behave like the real gateway, or the demo would lie. */
describe('simulated gateway', () => {
  const setup = () => {
    const db = ops.createDb()
    const merchant = db.merchants.get(DEMO_API_KEY)!
    const card = ops.tokenize(db, { pan: '4242424242424242', expiryMonth: 12, expiryYear: 2099 })
    return { db, merchant, card }
  }

  it('replays the original payment for a repeated idempotency key', () => {
    const { db, merchant, card } = setup()
    const input = { amount: 1_000, currency: 'MYR', cardToken: card.token, capture: true }

    const first = ops.createPayment(db, merchant, 'order-0001', input)
    const second = ops.createPayment(db, merchant, 'order-0001', input)

    expect(second.replayed).toBe(true)
    expect(second.payment.id).toBe(first.payment.id)
  })

  it('rejects a reused idempotency key with a different body', () => {
    const { db, merchant, card } = setup()
    ops.createPayment(db, merchant, 'order-0002', { amount: 1_000, currency: 'MYR', cardToken: card.token })

    expect(() =>
      ops.createPayment(db, merchant, 'order-0002', { amount: 9_999, currency: 'MYR', cardToken: card.token }),
    ).toThrow(/different request body/)
  })

  it('declines the magic test card', () => {
    const { db, merchant } = setup()
    const declined = ops.tokenize(db, { pan: '4000000000000002', expiryMonth: 12, expiryYear: 2099 })

    const { payment } = ops.createPayment(db, merchant, 'order-0003', { amount: 500, currency: 'MYR', cardToken: declined.token })

    expect(payment.status).toBe('DECLINED')
    expect(payment.declineReason).toBe('card_declined')
  })

  it('enforces the payment state machine', () => {
    const { db, merchant, card } = setup()
    const { payment } = ops.createPayment(db, merchant, 'order-0004', { amount: 10_000, currency: 'MYR', cardToken: card.token })

    ops.capture(db, merchant, payment.id, 8_000)
    expect(() => ops.capture(db, merchant, payment.id)).toThrow(/Cannot capture/)
    expect(() => ops.refund(db, merchant, payment.id, 8_001)).toThrow(/refundable amount/)

    ops.refund(db, merchant, payment.id, 3_000)
    expect(payment.status).toBe('PARTIALLY_REFUNDED')
    ops.refund(db, merchant, payment.id, 5_000)
    expect(payment.status).toBe('REFUNDED')
  })

  it('settles a date only once and marks ledger entries as settled', () => {
    const { db, merchant, card } = setup()
    ops.createPayment(db, merchant, 'order-0005', { amount: 10_000, currency: 'MYR', cardToken: card.token, capture: true })
    const today = new Date().toISOString().slice(0, 10)

    ops.runSettlement(db, today)

    expect(db.ledger.every((e) => e.settlementId !== null)).toBe(true)
    expect(() => ops.runSettlement(db, today)).toThrow(/already completed/)
  })

  it('validates card numbers with Luhn', () => {
    const { db } = setup()
    expect(() => ops.tokenize(db, { pan: '4242424242424241', expiryMonth: 12, expiryYear: 2099 })).toThrow(/Luhn/)
  })
})
