/** Amounts are integer minor units (sen/cents) everywhere, exactly like the backend. */
export function formatMoney(minor: number, currency = 'MYR'): string {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(minor / 100)
}

/** Parses "12.50" or "12" into minor units (1250). Returns NaN for anything else. */
export function toMinor(input: string): number {
  const trimmed = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN
  const [whole, fraction = ''] = trimmed.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(new Date(iso))
}
