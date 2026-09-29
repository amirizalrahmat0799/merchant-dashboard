import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderApp } from '@/test/render'

describe('login', () => {
  it('redirects to login when signed out', async () => {
    renderApp('/', { signedIn: false })
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('validates the API key format before calling the server', async () => {
    const { user } = renderApp('/login', { signedIn: false })
    await user.type(await screen.findByLabelText(/api key/i), 'not-a-key')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/start with sk_test_/i)).toBeInTheDocument()
  })

  it('shows the server error for an unknown key', async () => {
    const { user } = renderApp('/login', { signedIn: false })
    await user.type(await screen.findByLabelText(/api key/i), 'sk_test_doesnotexist')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or inactive api key/i)
  })

  it('signs in with a valid key and lands on the overview', async () => {
    const { user } = renderApp('/login', { signedIn: false })
    await user.type(await screen.findByLabelText(/api key/i), 'sk_test_demo_kedaikopi_cyberjaya')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/good day, kedai kopi cyberjaya/i)).toBeInTheDocument()
  })
})

describe('overview', () => {
  it('shows key figures and recent payments', async () => {
    renderApp('/')
    expect(await screen.findByText('Gross volume')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText(/RM\s?\d/).length).toBeGreaterThan(4))
    expect(screen.getByRole('heading', { name: /recent payments/i })).toBeInTheDocument()
  })

  it('logs out when the API key is no longer valid', async () => {
    server.use(
      http.get('*/payment-api/api/v1/payments', () =>
        HttpResponse.json({ status: 401, detail: 'Missing, invalid or inactive API key' }, { status: 401 }),
      ),
    )
    renderApp('/')
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

describe('new payment', () => {
  it('tokenizes the card and charges it', async () => {
    const { user } = renderApp('/payments/new')
    await user.type(await screen.findByLabelText(/amount/i), '42.50')
    await user.type(screen.getByLabelText(/card number/i), '4242 4242 4242 4242')
    await user.click(screen.getByRole('button', { name: /charge card/i }))

    expect(await screen.findByText(/payment approved/i)).toBeInTheDocument()
    expect(screen.getByText(/RM\s?42\.50/)).toBeInTheDocument()
    expect(screen.getByText('CAPTURED')).toBeInTheDocument()
  })

  it('shows a decline for the magic test card', async () => {
    const { user } = renderApp('/payments/new')
    await user.type(await screen.findByLabelText(/amount/i), '10')
    await user.click(screen.getByRole('button', { name: /declined: card_declined/i }))
    await user.click(screen.getByRole('button', { name: /charge card/i }))

    expect(await screen.findByText(/payment declined/i)).toBeInTheDocument()
    expect(screen.getByText('card_declined')).toBeInTheDocument()
  })

  it('validates the form', async () => {
    const { user } = renderApp('/payments/new')
    await user.click(await screen.findByRole('button', { name: /charge card/i }))
    expect(await screen.findByText(/enter an amount/i)).toBeInTheDocument()
    expect(screen.getByText(/12–19 digits/i)).toBeInTheDocument()
  })
})

describe('payment detail', () => {
  it('captures an authorized payment', async () => {
    const { user } = renderApp('/payments?status=AUTHORIZED')
    const rows = await screen.findAllByRole('row', { name: /RM/ })
    await user.click(rows[0])

    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByRole('button', { name: /^capture$/i }))

    await waitFor(() => expect(within(dialog).getByText('CAPTURED')).toBeInTheDocument())
    expect(within(dialog).getByRole('button', { name: /refund/i })).toBeInTheDocument()
  })

  it('surfaces the gateway error when refunding too much', async () => {
    const { user } = renderApp('/payments?status=CAPTURED')
    const rows = await screen.findAllByRole('row', { name: /RM/ })
    await user.click(rows[0])

    const dialog = await screen.findByRole('dialog')
    await user.type(await within(dialog).findByLabelText(/refund amount/i), '999999')
    await user.click(within(dialog).getByRole('button', { name: /refund/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/refundable amount/i)
  })
})

describe('settlements', () => {
  it('runs a settlement and refuses to run the same date twice', async () => {
    const { user } = renderApp('/settlements')
    const run = await screen.findByRole('button', { name: /run now/i })

    await user.click(run)
    expect(await screen.findByText(/finished: completed/i)).toBeInTheDocument()

    await user.click(run)
    expect(await screen.findByRole('alert')).toHaveTextContent(/already completed/i)
  })
})

describe('assistant', () => {
  it('answers a payout question with tools and sources', async () => {
    const { user } = renderApp('/assistant')
    await user.click(await screen.findByRole('button', { name: /how much money is waiting to be paid out/i }))

    expect(await screen.findByText(/waiting to be paid out, from/i)).toBeInTheDocument()
    expect(screen.getByText(/checked pending payout/i)).toBeInTheDocument()
    expect(screen.getByText(/fees and settlement: settlement timing/i)).toBeInTheDocument()
  })

  it('keeps the conversation going and can start over', async () => {
    const { user } = renderApp('/assistant')
    await user.type(await screen.findByLabelText(/message/i), 'Refund my last payment')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText(/can't issue refunds myself/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /new conversation/i }))
    expect(screen.queryByText(/can't issue refunds myself/i)).not.toBeInTheDocument()
  })

  it('explains when the assistant service is unavailable', async () => {
    server.use(http.post('*/assistant-api/api/v1/assistant/chat', () => HttpResponse.json({ status: 502 }, { status: 502 })))
    const { user } = renderApp('/assistant')
    await user.type(await screen.findByLabelText(/message/i), 'hello')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/assistant is unavailable/i)
  })
})
