import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentApi, settlementApi, type CreatePaymentInput } from './api'
import { useSession } from './auth-context'

/** How often lists refresh while the page is open, so new payments show up without reloading. */
const LIVE_REFRESH_MS = 10_000

export const keys = {
  payments: (page: number, size: number) => ['payments', page, size] as const,
  allPayments: ['payments'] as const,
  payment: (id: string) => ['payment', id] as const,
  refunds: (id: string) => ['refunds', id] as const,
  ledger: ['ledger'] as const,
  settlements: ['settlements'] as const,
}

export function usePayments(page: number, size: number) {
  const { apiKey } = useSession()
  return useQuery({
    queryKey: keys.payments(page, size),
    queryFn: () => paymentApi.list(apiKey, page, size),
    refetchInterval: LIVE_REFRESH_MS,
    placeholderData: (previous) => previous,
  })
}

export function usePayment(id: string | null) {
  const { apiKey } = useSession()
  return useQuery({
    queryKey: keys.payment(id ?? ''),
    queryFn: () => paymentApi.get(apiKey, id!),
    enabled: id !== null,
  })
}

export function useRefunds(id: string | null) {
  const { apiKey } = useSession()
  return useQuery({
    queryKey: keys.refunds(id ?? ''),
    queryFn: () => paymentApi.refunds(apiKey, id!),
    enabled: id !== null,
  })
}

export function useLedger() {
  const { merchant } = useSession()
  return useQuery({
    queryKey: keys.ledger,
    queryFn: () => settlementApi.ledger(merchant.id),
    refetchInterval: LIVE_REFRESH_MS,
  })
}

export function useSettlements() {
  const { merchant } = useSession()
  return useQuery({ queryKey: keys.settlements, queryFn: () => settlementApi.list(merchant.id) })
}

/** After any money movement, everything derived from payments may be stale. */
function useInvalidateMoney() {
  const qc = useQueryClient()
  return (paymentId?: string) => {
    void qc.invalidateQueries({ queryKey: keys.allPayments })
    void qc.invalidateQueries({ queryKey: keys.ledger })
    if (paymentId) {
      void qc.invalidateQueries({ queryKey: keys.payment(paymentId) })
      void qc.invalidateQueries({ queryKey: keys.refunds(paymentId) })
    }
  }
}

export function useCreatePayment() {
  const { apiKey } = useSession()
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ idempotencyKey, input }: { idempotencyKey: string; input: CreatePaymentInput }) =>
      paymentApi.create(apiKey, idempotencyKey, input),
    onSuccess: (p) => invalidate(p.id),
  })
}

export function useCapture() {
  const { apiKey } = useSession()
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount?: number }) => paymentApi.capture(apiKey, id, amount),
    onSuccess: (p) => invalidate(p.id),
  })
}

export function useVoid() {
  const { apiKey } = useSession()
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: (id: string) => paymentApi.void(apiKey, id),
    onSuccess: (p) => invalidate(p.id),
  })
}

export function useRefund() {
  const { apiKey } = useSession()
  const invalidate = useInvalidateMoney()
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => paymentApi.refund(apiKey, id, amount),
    onSuccess: (r) => invalidate(r.paymentId),
  })
}

export function useRunSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => settlementApi.run(date),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.settlements })
      void qc.invalidateQueries({ queryKey: keys.ledger })
    },
  })
}
