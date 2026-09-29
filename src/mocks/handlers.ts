import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw'
import * as ops from './db'
import { assistantReply } from './assistant'
import { createDb, MockError, type Db } from './db'

/** Handlers mirror the real endpoints; `*` matches any base path (e.g. GitHub Pages sub-path). */
export function createHandlers(db: Db = createDb(), latencyMs = 250) {
  const problem = (e: unknown) => {
    if (e instanceof MockError) {
      return HttpResponse.json({ status: e.status, title: statusTitle(e.status), detail: e.message }, { status: e.status })
    }
    throw e
  }

  /** Wraps a resolver with simulated latency and problem-detail error mapping. */
  const route =
    (fn: HttpResponseResolver): HttpResponseResolver =>
    async (info) => {
      if (latencyMs > 0) await delay(latencyMs)
      try {
        return await fn(info)
      } catch (e) {
        return problem(e)
      }
    }

  const apiKey = (request: Request) => request.headers.get('X-Api-Key')

  return [
    // ---------------- merchant-service ----------------
    http.get('*/merchant-api/api/v1/merchants/me', route(({ request }) => {
      const m = ops.authenticate(db, apiKey(request))
      return HttpResponse.json(publicMerchant(m))
    })),

    http.post('*/merchant-api/api/v1/merchants', route(async ({ request }) => {
      const body = (await request.json()) as { name: string; email: string; feeBps: number }
      return HttpResponse.json(ops.onboard(db, body), { status: 201 })
    })),

    http.post('*/merchant-api/api/v1/merchants/:id/api-key/rotate', route(({ params }) => {
      return HttpResponse.json(ops.rotateKey(db, String(params.id)))
    })),

    // ---------------- tokenization-service ----------------
    http.post('*/token-api/api/v1/tokens', route(async ({ request }) => {
      const body = (await request.json()) as { pan: string; expiryMonth: number; expiryYear: number }
      return HttpResponse.json(ops.tokenize(db, body), { status: 201 })
    })),

    // ---------------- payment-service ----------------
    http.get('*/payment-api/api/v1/payments', route(({ request }) => {
      const m = ops.authenticate(db, apiKey(request))
      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page') ?? 0)
      const size = Number(url.searchParams.get('size') ?? 20)
      return HttpResponse.json(ops.listPayments(db, m, page, size))
    })),

    http.post('*/payment-api/api/v1/payments', route(async ({ request }) => {
      const m = ops.authenticate(db, apiKey(request))
      const body = (await request.json()) as Parameters<typeof ops.createPayment>[3]
      const { payment, replayed } = ops.createPayment(db, m, request.headers.get('Idempotency-Key'), body)
      return replayed
        ? HttpResponse.json(payment, { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
        : HttpResponse.json(payment, { status: 201 })
    })),

    http.get('*/payment-api/api/v1/payments/:id', route(({ request, params }) => {
      const m = ops.authenticate(db, apiKey(request))
      return HttpResponse.json(ops.getPayment(db, m, String(params.id)))
    })),

    http.post('*/payment-api/api/v1/payments/:id/capture', route(async ({ request, params }) => {
      const m = ops.authenticate(db, apiKey(request))
      const text = await request.text()
      const body = text ? (JSON.parse(text) as { amount?: number }) : {}
      return HttpResponse.json(ops.capture(db, m, String(params.id), body.amount))
    })),

    http.post('*/payment-api/api/v1/payments/:id/void', route(({ request, params }) => {
      const m = ops.authenticate(db, apiKey(request))
      return HttpResponse.json(ops.voidPayment(db, m, String(params.id)))
    })),

    http.post('*/payment-api/api/v1/payments/:id/refunds', route(async ({ request, params }) => {
      const m = ops.authenticate(db, apiKey(request))
      const body = (await request.json()) as { amount: number }
      return HttpResponse.json(ops.refund(db, m, String(params.id), body.amount), { status: 201 })
    })),

    http.get('*/payment-api/api/v1/payments/:id/refunds', route(({ request, params }) => {
      const m = ops.authenticate(db, apiKey(request))
      return HttpResponse.json(ops.refundsOf(db, m, String(params.id)))
    })),

    // ---------------- settlement-service ----------------
    http.get('*/settlement-api/api/v1/ledger', route(({ request }) => {
      const url = new URL(request.url)
      const merchantId = url.searchParams.get('merchantId')
      const limit = Number(url.searchParams.get('limit') ?? 100)
      return HttpResponse.json(db.ledger.filter((e) => e.merchantId === merchantId).slice(0, limit))
    })),

    http.get('*/settlement-api/api/v1/settlements', route(({ request }) => {
      const merchantId = new URL(request.url).searchParams.get('merchantId')
      return HttpResponse.json(db.settlements.filter((s) => s.merchantId === merchantId))
    })),

    http.post('*/settlement-api/api/v1/settlements/run', route(({ request }) => {
      const date = new URL(request.url).searchParams.get('date') ?? ''
      return HttpResponse.json(ops.runSettlement(db, date))
    })),

    // ---------------- payment-assistant (scripted stand-in for the Spring AI service) ----------------
    http.post('*/assistant-api/api/v1/assistant/chat', route(async ({ request }) => {
      const m = ops.authenticate(db, apiKey(request))
      const body = (await request.json()) as { message?: string; conversationId?: string }
      if (!body.message?.trim()) throw new MockError(400, 'message must not be blank')
      return HttpResponse.json(assistantReply(db, m, body.message, body.conversationId))
    })),

    http.delete('*/assistant-api/api/v1/assistant/conversations/:id', route(({ request }) => {
      ops.authenticate(db, apiKey(request))
      return new HttpResponse(null, { status: 204 })
    })),
  ]
}

function publicMerchant(m: ReturnType<typeof ops.authenticate>) {
  const { apiKey: _secret, ...rest } = m
  void _secret
  return rest
}

function statusTitle(status: number) {
  return (
    {
      400: 'Bad Request',
      401: 'Unauthorized',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
    }[status] ?? 'Error'
  )
}
