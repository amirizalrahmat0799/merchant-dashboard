/**
 * Demo-mode stand-in for payment-assistant. The real service uses an LLM with tool calling and RAG;
 * this keyword router answers the suggested questions from the simulated gateway's data, so the
 * hosted demo can show the experience without a model behind it.
 */
import type { AssistantReply, Merchant } from '@/lib/types'
import type { Db } from './db'

const rm = (minor: number) => `RM ${(minor / 100).toFixed(2)}`

const DECLINE_TEXT: Record<string, string> = {
  card_declined: 'the issuing bank declined the card without a specific reason. The customer should try another card or call their bank.',
  insufficient_funds: "the card didn't have enough available balance. The customer can try a smaller amount or another card.",
  expired_card: 'the card has expired. The customer needs a card that is still valid.',
  amount_limit_exceeded: 'the amount is above the RM 50,000.00 per-transaction limit. Split it into smaller payments.',
}

export function assistantReply(db: Db, merchant: Merchant, message: string, conversationId?: string): AssistantReply {
  const q = message.toLowerCase()
  const id = conversationId ?? crypto.randomUUID()
  const reply = (text: string, toolsUsed: string[], sources: AssistantReply['sources']): AssistantReply => ({
    conversationId: id,
    reply: text,
    toolsUsed,
    sources,
    totalTokens: 600 + Math.round(text.length / 3),
  })

  const reason = Object.keys(DECLINE_TEXT).find((r) => q.includes(r))
  if (reason && /(mean|what is|what's|explain)/.test(q)) {
    return reply(`**${reason}** means ${DECLINE_TEXT[reason]}\n\nA declined payment is final and never charged. Create a new payment once the customer has fixed the problem.`,
      [], [{ title: 'Decline reasons', section: reason }])
  }

  if (/(payout|paid out|pay me|settle|settlement|waiting)/.test(q)) {
    const pending = db.ledger.filter((e) => e.merchantId === merchant.id && e.settlementId === null)
    const captured = pending.filter((e) => e.entryType === 'CAPTURE').reduce((s, e) => s + e.amount, 0)
    const refunded = pending.filter((e) => e.entryType === 'REFUND').reduce((s, e) => s + e.amount, 0)
    const fees = pending.reduce((s, e) => s + e.fee, 0)
    const last = db.settlements.find((s) => s.merchantId === merchant.id)
    return reply(
      `You have **${rm(captured - refunded - fees)}** waiting to be paid out, from ${pending.length} unsettled ledger entries:\n` +
        `- Captured: ${rm(captured)}\n- Refunded: ${rm(refunded)}\n- Fees: ${rm(fees)}\n\n` +
        `Settlement runs every night at 00:05 UTC (08:05 in Malaysia) and pays out everything up to the end of the previous UTC day.` +
        (last ? ` Your last payout was ${rm(last.netAmount)} on ${last.settlementDate}.` : ''),
      ['getPayoutSummary'],
      [{ title: 'Fees and settlement', section: 'Settlement timing' }],
    )
  }

  if (/(declin|fail|reject)/.test(q)) {
    const declined = db.payments.filter((p) => db.paymentOwner.get(p.id) === merchant.id && p.status === 'DECLINED').slice(0, 3)
    if (declined.length === 0) {
      return reply("Good news: none of your recent payments were declined.", ['listRecentPayments'], [])
    }
    const lines = declined.map((p) => `- ${rm(p.amount)} on ${p.card.brand} ending ${p.card.last4} (${p.createdAt.slice(0, 10)}): **${p.declineReason}**`)
    const reasons = [...new Set(declined.map((p) => p.declineReason!))]
    return reply(
      `Your ${declined.length} most recent declined payments:\n${lines.join('\n')}\n\n` +
        reasons.map((r) => `**${r}**: ${DECLINE_TEXT[r] ?? 'see the decline reasons guide.'}`).join('\n'),
      ['listRecentPayments'],
      reasons.map((r) => ({ title: 'Decline reasons', section: r })),
    )
  }

  if (/refund/.test(q)) {
    return reply(
      "I can't issue refunds myself: anything that moves money stays with you. To refund:\n" +
        '- Open **Payments** and click the payment\n- Enter an amount, or leave it empty to refund the remaining amount\n- Click **Refund**\n\n' +
        'Only captured payments can be refunded, and the refunds can add up to at most the captured amount. The processing fee is not returned.',
      [],
      [{ title: 'Payment lifecycle', section: 'Refunds' }, { title: 'Fees and settlement', section: 'Refunds and fees' }],
    )
  }

  return reply(
    'I can help with your payments, refunds, payouts and settlements, and explain how the gateway works: decline reasons, fees, idempotency keys or test cards. What would you like to know?',
    [],
    [],
  )
}
