import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { CopyButton, ErrorBanner, Modal, PageHeader, Spinner } from '@/components/ui'
import { merchantApi } from '@/lib/api'
import { useAuth, useSession } from '@/lib/auth-context'
import { formatDate } from '@/lib/money'
import type { Merchant } from '@/lib/types'

export function SettingsPage() {
  const { merchant } = useSession()
  const { replaceKey } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [rotated, setRotated] = useState<Merchant | null>(null)

  const rotate = useMutation({
    mutationFn: () => merchantApi.rotateKey(merchant.id),
    onSuccess: (m) => {
      setConfirming(false)
      setRotated(m)
      if (m.apiKey) replaceKey(m.apiKey, m)
    },
  })

  return (
    <>
      <PageHeader title="Settings" />

      <section className="card mb-6 p-6" aria-labelledby="account-title">
        <h2 id="account-title" className="mb-4 font-semibold">
          Account
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Item label="Business name" value={merchant.name} />
          <Item label="Email" value={merchant.email} />
          <Item label="Status" value={merchant.status.toLowerCase()} />
          <Item label="Processing fee" value={`${(merchant.feeBps / 100).toFixed(2)}% (${merchant.feeBps} bps)`} />
          <Item label="Merchant ID" value={merchant.id} mono />
          <Item label="Member since" value={formatDate(merchant.createdAt)} />
        </dl>
      </section>

      <section className="card p-6" aria-labelledby="keys-title">
        <h2 id="keys-title" className="font-semibold">
          API key
        </h2>
        <p className="mt-1 text-sm text-muted">
          Only a SHA-256 hash of your key is stored, so it can't be shown again. Rotate it if it may have leaked.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm">
            {(rotated?.apiKeyPrefix ?? merchant.apiKeyPrefix) + '••••••••••••'}
          </code>
          <button type="button" className="btn-secondary" onClick={() => setConfirming(true)}>
            <KeyRound className="size-4" aria-hidden /> Rotate key
          </button>
        </div>

        {rotated?.apiKey && (
          <div className="mt-4 rounded-lg border border-accent/40 bg-accent-soft p-4">
            <p className="text-sm font-semibold">New API key. Copy it now, it won't be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all font-mono text-xs">{rotated.apiKey}</code>
              <CopyButton value={rotated.apiKey} label="Copy new API key" />
            </div>
          </div>
        )}
      </section>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Rotate API key?">
        <p className="text-sm text-muted">
          Your current key stops working immediately. Any integration still using it will get 401 errors until you update it.
        </p>
        {rotate.error && (
          <div className="mt-4">
            <ErrorBanner error={rotate.error} />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button type="button" className="btn-danger" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
            {rotate.isPending && <Spinner />} Rotate key
          </button>
        </div>
      </Modal>
    </>
  )
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={mono ? 'mt-0.5 font-mono text-xs break-all' : 'mt-0.5'}>{value}</dd>
    </div>
  )
}
