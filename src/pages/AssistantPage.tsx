import { useMutation } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { BookOpen, Bot, MessageSquarePlus, Send, Wrench } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ErrorBanner, PageHeader } from '@/components/ui'
import { ApiError, assistantApi } from '@/lib/api'
import { useSession } from '@/lib/auth-context'
import { DEMO_MODE } from '@/lib/demo'
import type { AssistantReply } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  text: string
  meta?: Pick<AssistantReply, 'sources' | 'toolsUsed' | 'totalTokens'>
}

const SUGGESTIONS = [
  'How much money is waiting to be paid out?',
  'Why were my recent payments declined?',
  'What does insufficient_funds mean?',
  'How do I refund a payment?',
]

const TOOL_LABELS: Record<string, string> = {
  getPayment: 'Looked up a payment',
  listRecentPayments: 'Checked recent payments',
  getRefunds: 'Checked refunds',
  getPayoutSummary: 'Checked pending payout',
  listSettlements: 'Checked settlements',
}

export function AssistantPage() {
  const { apiKey, merchant } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string>()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const ask = useMutation({
    mutationFn: (message: string) => assistantApi.chat(apiKey, message, conversationId),
    onSuccess: (reply) => {
      setConversationId(reply.conversationId)
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: reply.reply, meta: { sources: reply.sources, toolsUsed: reply.toolsUsed, totalTokens: reply.totalTokens } },
      ])
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages, ask.isPending])

  const send = (text: string) => {
    const message = text.trim()
    if (!message || ask.isPending) return
    setMessages((m) => [...m, { role: 'user', text: message }])
    setInput('')
    ask.mutate(message)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const newConversation = () => {
    if (conversationId) void assistantApi.forget(apiKey, conversationId).catch(() => undefined)
    setMessages([])
    setConversationId(undefined)
    ask.reset()
  }

  return (
    <>
      <PageHeader
        title="Assistant"
        subtitle="Ask about your payments, payouts, or how the gateway works."
        actions={
          messages.length > 0 ? (
            <button type="button" className="btn-secondary" onClick={newConversation}>
              <MessageSquarePlus className="size-4" aria-hidden /> New conversation
            </button>
          ) : undefined
        }
      />

      {DEMO_MODE && (
        <p className="mb-4 text-xs text-muted">
          Demo mode: answers are scripted from your demo data. The real assistant is a Spring AI service using Amazon Bedrock
          with tool calling and RAG (see the payment-assistant repo).
        </p>
      )}

      <div className="card flex h-[calc(100vh-15rem)] min-h-[420px] flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="mb-4 grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
                <Bot className="size-6" aria-hidden />
              </span>
              <p className="font-semibold">Hi {merchant.name}, how can I help?</p>
              <p className="mt-1 max-w-md text-sm text-muted">
                I can look up your payments and payouts and explain how the gateway works. I can't change anything:
                refunds and captures stay with you.
              </p>
              <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="btn-secondary px-3 py-1.5 text-xs font-medium" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatBubble key={i} message={m} />
          ))}

          {ask.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Bot className="size-4" aria-hidden />
              <span className="animate-pulse">Thinking…</span>
            </div>
          )}
          {ask.error && (
            <ErrorBanner
              error={
                ask.error instanceof ApiError && [0, 502, 503, 504].includes(ask.error.status)
                  ? new Error('The assistant is unavailable right now. Is payment-assistant running?')
                  : ask.error
              }
            />
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-line p-3">
          <label htmlFor="assistant-input" className="sr-only">
            Message
          </label>
          <input
            id="assistant-input"
            className="input"
            placeholder="Ask a question…"
            value={input}
            maxLength={1000}
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={ask.isPending || !input.trim()} aria-label="Send">
            <Send className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </>
  )
}

function ChatBubble({ message }: { message: Message }) {
  const mine = message.role === 'user'
  return (
    <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[85%] sm:max-w-[75%]', mine && 'text-right')}>
        <div
          className={clsx(
            'inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed',
            mine ? 'rounded-br-md bg-accent text-accent-fg' : 'rounded-bl-md bg-surface-2 text-fg',
          )}
        >
          {mine ? message.text : <FormattedText text={message.text} />}
        </div>
        {message.meta && (message.meta.toolsUsed.length > 0 || message.meta.sources.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
            {[...new Set(message.meta.toolsUsed)].map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
                <Wrench className="size-3" aria-hidden /> {TOOL_LABELS[t] ?? t}
              </span>
            ))}
            {message.meta.sources.map((s) => (
              <span key={s.title + s.section} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
                <BookOpen className="size-3" aria-hidden /> {s.title}: {s.section}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Minimal, safe rendering of the model's markdown: paragraphs, "- " bullet lists and **bold**.
 * Built from React elements (no innerHTML), so model output can't inject markup.
 */
export function FormattedText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []

  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="my-1 list-disc space-y-0.5 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>{bold(b)}</li>
          ))}
        </ul>,
      )
      bullets = []
    }
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const bullet = /^([-*•]|\d+\.)\s+(.*)$/.exec(line)
    if (bullet) {
      bullets.push(bullet[2])
    } else {
      flush()
      if (line) blocks.push(<p key={blocks.length} className="my-1">{bold(line)}</p>)
    }
  }
  flush()
  return <>{blocks}</>
}

function bold(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}
