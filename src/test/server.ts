import { setupServer } from 'msw/node'
import { createDb, type Db } from '@/mocks/db'
import { createHandlers } from '@/mocks/handlers'

/** Tests run against the same simulated gateway as the hosted demo, without latency. */
export let db: Db = createDb()
export const server = setupServer(...createHandlers(db, 0))

/** Fresh data for every test. */
export function resetServer() {
  db = createDb()
  server.resetHandlers(...createHandlers(db, 0))
}
