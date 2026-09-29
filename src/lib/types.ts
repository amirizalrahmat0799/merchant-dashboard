// Types mirror the JSON returned by the payment-gateway-sim services.

export type MerchantStatus = 'ACTIVE' | 'SUSPENDED'

export interface Merchant {
  id: string
  name: string
  email: string
  status: MerchantStatus
  feeBps: number
  apiKeyPrefix: string
  /** Only present right after onboarding or key rotation. */
  apiKey?: string
  createdAt: string
}

export type PaymentStatus =
  | 'AUTHORIZED'
  | 'DECLINED'
  | 'CAPTURED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'VOIDED'

export interface Payment {
  id: string
  status: PaymentStatus
  amount: number
  currency: string
  capturedAmount: number
  refundedAmount: number
  refundableAmount: number
  card: { token: string; brand: string; last4: string }
  authCode?: string
  declineReason?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface Refund {
  id: string
  paymentId: string
  amount: number
  createdAt: string
}

export interface CardToken {
  token: string
  brand: string
  last4: string
  expiryMonth: number
  expiryYear: number
  fingerprint: string
  expired: boolean
}

export interface LedgerEntry {
  id: string
  paymentId: string
  merchantId: string
  entryType: 'CAPTURE' | 'REFUND'
  amount: number
  currency: string
  fee: number
  occurredAt: string
  settlementId: string | null
}

export interface Settlement {
  id: string
  merchantId: string
  currency: string
  settlementDate: string
  grossCaptured: number
  grossRefunded: number
  fees: number
  netAmount: number
  entryCount: number
  createdAt: string
}

export interface SettlementRun {
  jobExecutionId: number
  settlementDate: string
  status: string
  exitDescription: string
}

/** RFC 9457 problem details, as returned by every service. */
export interface ProblemDetail {
  type?: string
  title?: string
  status: number
  detail?: string
}
