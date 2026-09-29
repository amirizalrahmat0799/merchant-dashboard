import type {
  CardToken,
  LedgerEntry,
  Merchant,
  Page,
  Payment,
  ProblemDetail,
  Refund,
  Settlement,
  SettlementRun,
} from './types'

/** Path prefixes are proxied to the four services (Vite in dev, nginx in production). */
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
export const SERVICES = {
  merchant: `${base}/merchant-api`,
  payment: `${base}/payment-api`,
  token: `${base}/token-api`,
  settlement: `${base}/settlement-api`,
} as const

export class ApiError extends Error {
  readonly status: number
  readonly problem?: ProblemDetail

  constructor(status: number, problem?: ProblemDetail) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
  apiKey?: string
  idempotencyKey?: string
  body?: unknown
}

async function request<T>(url: string, { method = 'GET', apiKey, idempotencyKey, body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (apiKey) headers['X-Api-Key'] = apiKey
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  let res: Response
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, { status: 0, title: 'Network error', detail: 'Could not reach the gateway. Is it running?' })
  }

  if (!res.ok) {
    let problem: ProblemDetail | undefined
    try {
      problem = (await res.json()) as ProblemDetail
    } catch {
      problem = undefined
    }
    throw new ApiError(res.status, problem)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ---------- merchant-service ----------
export const merchantApi = {
  me: (apiKey: string) => request<Merchant>(`${SERVICES.merchant}/api/v1/merchants/me`, { apiKey }),

  onboard: (input: { name: string; email: string; feeBps: number }) =>
    request<Merchant>(`${SERVICES.merchant}/api/v1/merchants`, { method: 'POST', body: input }),

  rotateKey: (merchantId: string) =>
    request<Merchant>(`${SERVICES.merchant}/api/v1/merchants/${merchantId}/api-key/rotate`, { method: 'POST' }),
}

// ---------- tokenization-service ----------
export const tokenApi = {
  tokenize: (input: { pan: string; expiryMonth: number; expiryYear: number; cardholderName?: string }) =>
    request<CardToken>(`${SERVICES.token}/api/v1/tokens`, { method: 'POST', body: input }),
}

// ---------- payment-service ----------
export interface CreatePaymentInput {
  amount: number
  currency: string
  cardToken: string
  capture: boolean
  description?: string
}

export const paymentApi = {
  list: (apiKey: string, page = 0, size = 20) =>
    request<Page<Payment>>(`${SERVICES.payment}/api/v1/payments?page=${page}&size=${size}`, { apiKey }),

  get: (apiKey: string, id: string) => request<Payment>(`${SERVICES.payment}/api/v1/payments/${id}`, { apiKey }),

  create: (apiKey: string, idempotencyKey: string, input: CreatePaymentInput) =>
    request<Payment>(`${SERVICES.payment}/api/v1/payments`, { method: 'POST', apiKey, idempotencyKey, body: input }),

  capture: (apiKey: string, id: string, amount?: number) =>
    request<Payment>(`${SERVICES.payment}/api/v1/payments/${id}/capture`, {
      method: 'POST',
      apiKey,
      body: amount === undefined ? {} : { amount },
    }),

  void: (apiKey: string, id: string) =>
    request<Payment>(`${SERVICES.payment}/api/v1/payments/${id}/void`, { method: 'POST', apiKey }),

  refund: (apiKey: string, id: string, amount: number) =>
    request<Refund>(`${SERVICES.payment}/api/v1/payments/${id}/refunds`, { method: 'POST', apiKey, body: { amount } }),

  refunds: (apiKey: string, id: string) =>
    request<Refund[]>(`${SERVICES.payment}/api/v1/payments/${id}/refunds`, { apiKey }),
}

// ---------- settlement-service ----------
export const settlementApi = {
  ledger: (merchantId: string, limit = 200) =>
    request<LedgerEntry[]>(`${SERVICES.settlement}/api/v1/ledger?merchantId=${merchantId}&limit=${limit}`),

  list: (merchantId: string) =>
    request<Settlement[]>(`${SERVICES.settlement}/api/v1/settlements?merchantId=${merchantId}`),

  run: (date: string) =>
    request<SettlementRun>(`${SERVICES.settlement}/api/v1/settlements/run?date=${date}`, { method: 'POST' }),
}
