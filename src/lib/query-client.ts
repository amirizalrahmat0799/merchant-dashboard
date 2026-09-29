import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const UNAUTHORIZED_EVENT = 'pgs:unauthorized'

/** A 401 from any request means the key was rotated or revoked: end the session. */
function notifyIfUnauthorized(error: unknown) {
  if (error instanceof ApiError && error.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: notifyIfUnauthorized }),
    mutationCache: new MutationCache({ onError: notifyIfUnauthorized }),
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  })
}
