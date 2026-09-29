/**
 * In-memory stand-in for the payment-gateway-sim backend, used for the hosted demo and in tests.
 * It follows the same rules as the Spring Boot services: idempotency keys, the payment state
 * machine, issuer "magic" test cards, fees in basis points and settle-once semantics.
 */
import { DEMO_API_KEY } from '@/lib/demo'
import type { CardToken, LedgerEntry, Merchant, Payment, PaymentStatus, Refund, Settlement } from '@/lib/types'


export class MockError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface IdempotencyRecord {
  hash: string
  paymentId: string
}

export interface Db {
  merchants: Map<string, Merchant & { apiKey: string }>
  tokens: Map<string, CardToken>
  payments: Payment[]
  paymentOwner: Map<string, string>
  refunds: Refund[]
  idempotency: Map<string, IdempotencyRecord>
  ledger: LedgerEntry[]
  settlements: Settlement[]
  settledDates: Set<string>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uuid = () => crypto.randomUUID()
const hex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')

export function luhnValid(pan: string): boolean {
  if (!/^\d{12,19}$/.test(pan)) return false
  let sum = 0
  let double = false
  for (let i = pan.length - 1; i >= 0; i--) {
    let d = Number(pan[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

export function detectBrand(pan: string): string {
  if (pan.startsWith('4')) return 'VISA'
  if (pan.startsWith('34') || pan.startsWith('37')) return 'AMEX'
  const two = Number(pan.slice(0, 2))
  const four = Number(pan.slice(0, 4))
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'MASTERCARD'
  return 'UNKNOWN'
}

/** Basis points, rounded half-up, like FeeCalculator in settlement-service. */
export const fee = (amount: number, bps: number) => Math.round((amount * bps) / 10_000)

function refundable(p: Payment) {
  return p.capturedAmount - p.refundedAmount
}

function touch(p: Payment, status: PaymentStatus) {
  p.status = status
  p.updatedAt = new Date().toISOString()
  p.refundableAmount = refundable(p)
}

// ---------------------------------------------------------------------------
// Operations (mirror the REST endpoints)
// ---------------------------------------------------------------------------

export function authenticate(db: Db, apiKey: string | null) {
  const m = apiKey ? db.merchants.get(apiKey) : undefined
  if (!m || m.status !== 'ACTIVE') throw new MockError(401, 'Missing, invalid or inactive API key')
  return m
}

export function onboard(db: Db, input: { name: string; email: string; feeBps: number }) {
  if ([...db.merchants.values()].some((m) => m.email.toLowerCase() === input.email.toLowerCase())) {
    throw new MockError(409, `A merchant with email ${input.email} already exists`)
  }
  const apiKey = `sk_test_${hex(24)}`
  const merchant = {
    id: uuid(),
    name: input.name,
    email: input.email.toLowerCase(),
    status: 'ACTIVE' as const,
    feeBps: input.feeBps,
    apiKeyPrefix: apiKey.slice(0, 12),
    apiKey,
    createdAt: new Date().toISOString(),
  }
  db.merchants.set(apiKey, merchant)
  return merchant
}

export function rotateKey(db: Db, merchantId: string) {
  const entry = [...db.merchants.entries()].find(([, m]) => m.id === merchantId)
  if (!entry) throw new MockError(404, `Merchant ${merchantId} not found`)
  const [oldKey, merchant] = entry
  const apiKey = `sk_test_${hex(24)}`
  db.merchants.delete(oldKey)
  const updated = { ...merchant, apiKey, apiKeyPrefix: apiKey.slice(0, 12) }
  db.merchants.set(apiKey, updated)
  return updated
}

export function tokenize(db: Db, input: { pan: string; expiryMonth: number; expiryYear: number }) {
  const pan = String(input.pan ?? '').replace(/[\s-]/g, '')
  if (!luhnValid(pan)) throw new MockError(422, 'Card number failed Luhn check')
  const brand = detectBrand(pan)
  if (brand === 'UNKNOWN') throw new MockError(422, 'Unsupported card brand')
  const now = new Date()
  const expired =
    input.expiryYear < now.getFullYear() ||
    (input.expiryYear === now.getFullYear() && input.expiryMonth < now.getMonth() + 1)
  if (expired) throw new MockError(422, 'Card is expired')
  const token: CardToken = {
    token: `tok_${hex(12)}`,
    brand,
    last4: pan.slice(-4),
    expiryMonth: input.expiryMonth,
    expiryYear: input.expiryYear,
    fingerprint: hex(32),
    expired: false,
  }
  db.tokens.set(token.token, token)
  return token
}

interface CreateInput {
  amount: number
  currency: string
  cardToken: string
  capture?: boolean
  description?: string
}

export function createPayment(db: Db, merchant: Merchant, idempotencyKey: string | null, input: CreateInput) {
  if (!idempotencyKey || idempotencyKey.length < 8) {
    throw new MockError(400, 'Idempotency-Key header is required (8-100 characters)')
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new MockError(400, 'amount must be positive')
  if (!/^[A-Z]{3}$/.test(input.currency ?? '')) throw new MockError(400, 'currency must be an ISO-4217 code such as MYR')

  const hash = JSON.stringify([input.amount, input.currency, input.cardToken, !!input.capture, input.description ?? ''])
  const idemKey = `${merchant.id}|${idempotencyKey}`
  const existing = db.idempotency.get(idemKey)
  if (existing) {
    if (existing.hash !== hash) {
      throw new MockError(422, `Idempotency-Key '${idempotencyKey}' was already used with a different request body`)
    }
    return { payment: db.payments.find((p) => p.id === existing.paymentId)!, replayed: true }
  }

  const card = db.tokens.get(input.cardToken)
  if (!card) throw new MockError(422, `Unknown card token ${input.cardToken}`)

  const declineReason =
    card.expired ? 'expired_card'
    : card.last4 === '0002' ? 'card_declined'
    : card.last4 === '9995' ? 'insufficient_funds'
    : input.amount > 5_000_000 ? 'amount_limit_exceeded'
    : undefined

  const now = new Date().toISOString()
  const payment: Payment = {
    id: uuid(),
    status: declineReason ? 'DECLINED' : 'AUTHORIZED',
    amount: input.amount,
    currency: input.currency,
    capturedAmount: 0,
    refundedAmount: 0,
    refundableAmount: 0,
    card: { token: card.token, brand: card.brand, last4: card.last4 },
    authCode: declineReason ? undefined : hex(3).toUpperCase(),
    declineReason,
    description: input.description || undefined,
    createdAt: now,
    updatedAt: now,
  }
  db.payments.unshift(payment)
  db.paymentOwner.set(payment.id, merchant.id)
  db.idempotency.set(idemKey, { hash, paymentId: payment.id })

  if (!declineReason && input.capture) capture(db, merchant, payment.id)
  return { payment, replayed: false }
}

function load(db: Db, merchant: Merchant, id: string) {
  const p = db.payments.find((x) => x.id === id)
  if (!p || db.paymentOwner.get(id) !== merchant.id) throw new MockError(404, `Payment ${id} not found`)
  return p
}

export function getPayment(db: Db, merchant: Merchant, id: string) {
  return load(db, merchant, id)
}

export function listPayments(db: Db, merchant: Merchant, page: number, size: number) {
  const mine = db.payments.filter((p) => db.paymentOwner.get(p.id) === merchant.id)
  const s = Math.min(Math.max(size, 1), 100)
  return {
    items: mine.slice(page * s, page * s + s),
    page,
    size: s,
    totalItems: mine.length,
    totalPages: Math.ceil(mine.length / s),
  }
}

function addLedger(db: Db, merchant: Merchant, p: Payment, type: 'CAPTURE' | 'REFUND', amount: number, at = new Date()) {
  db.ledger.unshift({
    id: uuid(),
    paymentId: p.id,
    merchantId: merchant.id,
    entryType: type,
    amount,
    currency: p.currency,
    fee: type === 'CAPTURE' ? fee(amount, merchant.feeBps) : 0,
    occurredAt: at.toISOString(),
    settlementId: null,
  })
}

export function capture(db: Db, merchant: Merchant, id: string, amount?: number) {
  const p = load(db, merchant, id)
  if (p.status !== 'AUTHORIZED') {
    throw new MockError(422, `Cannot capture a payment in status ${p.status} (expected AUTHORIZED)`)
  }
  const toCapture = amount ?? p.amount
  if (!Number.isInteger(toCapture) || toCapture <= 0 || toCapture > p.amount) {
    throw new MockError(422, `Capture amount must be between 1 and the authorized amount (${p.amount})`)
  }
  p.capturedAmount = toCapture
  touch(p, 'CAPTURED')
  addLedger(db, merchant, p, 'CAPTURE', toCapture)
  return p
}

export function voidPayment(db: Db, merchant: Merchant, id: string) {
  const p = load(db, merchant, id)
  if (p.status !== 'AUTHORIZED') {
    throw new MockError(422, `Cannot void a payment in status ${p.status} (expected AUTHORIZED)`)
  }
  touch(p, 'VOIDED')
  return p
}

export function refund(db: Db, merchant: Merchant, id: string, amount: number) {
  const p = load(db, merchant, id)
  if (p.status !== 'CAPTURED' && p.status !== 'PARTIALLY_REFUNDED') {
    throw new MockError(422, `Cannot refund a payment in status ${p.status}`)
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > refundable(p)) {
    throw new MockError(422, `Refund amount must be between 1 and the refundable amount (${refundable(p)})`)
  }
  p.refundedAmount += amount
  touch(p, p.refundedAmount === p.capturedAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED')
  const r: Refund = { id: uuid(), paymentId: p.id, amount, createdAt: new Date().toISOString() }
  db.refunds.unshift(r)
  addLedger(db, merchant, p, 'REFUND', amount)
  return r
}

export function refundsOf(db: Db, merchant: Merchant, id: string) {
  load(db, merchant, id)
  return db.refunds.filter((r) => r.paymentId === id).reverse()
}

export function runSettlement(db: Db, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new MockError(400, 'date must be yyyy-MM-dd')
  if (db.settledDates.has(date)) throw new MockError(409, `Settlement for ${date} has already completed`)
  const cutoff = new Date(`${date}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() + 1)

  const groups = new Map<string, LedgerEntry[]>()
  for (const e of db.ledger) {
    if (e.settlementId === null && new Date(e.occurredAt) < cutoff) {
      const k = `${e.merchantId}|${e.currency}`
      groups.set(k, [...(groups.get(k) ?? []), e])
    }
  }
  for (const entries of groups.values()) {
    const grossCaptured = entries.filter((e) => e.entryType === 'CAPTURE').reduce((s, e) => s + e.amount, 0)
    const grossRefunded = entries.filter((e) => e.entryType === 'REFUND').reduce((s, e) => s + e.amount, 0)
    const fees = entries.reduce((s, e) => s + e.fee, 0)
    const settlement: Settlement = {
      id: uuid(),
      merchantId: entries[0].merchantId,
      currency: entries[0].currency,
      settlementDate: date,
      grossCaptured,
      grossRefunded,
      fees,
      netAmount: grossCaptured - grossRefunded - fees,
      entryCount: entries.length,
      createdAt: new Date().toISOString(),
    }
    db.settlements.unshift(settlement)
    entries.forEach((e) => (e.settlementId = settlement.id))
  }
  db.settledDates.add(date)
  return { jobExecutionId: db.settledDates.size, settlementDate: date, status: 'COMPLETED', exitDescription: '' }
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

/** Small deterministic PRNG so the demo looks the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DESCRIPTIONS = [
  'Kopi O ×2', 'Nasi lemak set', 'Teh tarik', 'Roti canai + kopi', 'Catering order',
  'Coffee beans 1kg', 'Mee goreng', 'Breakfast combo', 'Gift card', 'Iced latte ×3',
]

export function createDb(): Db {
  const db: Db = {
    merchants: new Map(),
    tokens: new Map(),
    payments: [],
    paymentOwner: new Map(),
    refunds: [],
    idempotency: new Map(),
    ledger: [],
    settlements: [],
    settledDates: new Set(),
  }

  const merchant = {
    id: '6f1c2d9e-8a4b-4c1e-9f3a-2b7d5e8c1a01',
    name: 'Kedai Kopi Cyberjaya',
    email: 'owner@kedaikopi.example',
    status: 'ACTIVE' as const,
    feeBps: 250,
    apiKeyPrefix: DEMO_API_KEY.slice(0, 12),
    apiKey: DEMO_API_KEY,
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  }
  db.merchants.set(DEMO_API_KEY, merchant)

  const cards = [
    { pan: '4242424242424242', weight: 6 },
    { pan: '5555555555554444', weight: 4 },
    { pan: '378282246310005', weight: 1 },
    { pan: '4000000000000002', weight: 1 },
  ].flatMap(({ pan, weight }) => {
    const t = tokenize(db, { pan, expiryMonth: 12, expiryYear: new Date().getFullYear() + 3 })
    return Array.from({ length: weight }, () => t.token)
  })

  const rand = mulberry32(42)
  const now = Date.now()
  const DAYS = 14

  for (let i = 0; i < 64; i++) {
    const at = new Date(now - rand() * DAYS * 86_400_000)
    const amount = Math.round((5 + rand() * 245) * 100)
    const r = rand()
    const { payment } = createPayment(db, merchant, `seed-${i.toString().padStart(4, '0')}`, {
      amount,
      currency: 'MYR',
      cardToken: cards[Math.floor(rand() * cards.length)],
      capture: false,
      description: DESCRIPTIONS[Math.floor(rand() * DESCRIPTIONS.length)],
    })
    payment.createdAt = payment.updatedAt = at.toISOString()
    if (payment.status === 'DECLINED') continue

    if (r < 0.72) {
      capture(db, merchant, payment.id)
    } else if (r < 0.8) {
      capture(db, merchant, payment.id)
      refund(db, merchant, payment.id, Math.round(payment.capturedAmount * 0.4))
    } else if (r < 0.85) {
      capture(db, merchant, payment.id)
      refund(db, merchant, payment.id, payment.capturedAmount)
    } else if (r < 0.9) {
      voidPayment(db, merchant, payment.id)
    }
    // else: stays AUTHORIZED, ready to capture in the demo

    payment.updatedAt = at.toISOString()
    db.ledger.filter((e) => e.paymentId === payment.id).forEach((e) => (e.occurredAt = at.toISOString()))
    db.refunds.filter((x) => x.paymentId === payment.id).forEach((x) => (x.createdAt = at.toISOString()))
  }

  db.payments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  db.ledger.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  // Settle each day up to 3 days ago, leaving recent activity for the "Run settlement" demo.
  for (let d = DAYS; d >= 3; d--) {
    runSettlement(db, new Date(now - d * 86_400_000).toISOString().slice(0, 10))
  }
  db.settlements.forEach((s) => (s.createdAt = `${s.settlementDate}T00:05:00Z`))
  return db
}
