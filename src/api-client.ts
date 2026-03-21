import axios, { AxiosInstance, AxiosError } from 'axios'
import { getToken, getBaseUrl, resolveEnvironment } from './config'

export interface PaginatedResponse<T> {
  current_page: number
  per_page: number
  total_entries: number
  collection: T[]
}

export interface ApiOptions {
  test: boolean
}

export function createClient(opts: ApiOptions): AxiosInstance {
  const env = resolveEnvironment(opts.test)
  const token = getToken(env)
  const baseURL = getBaseUrl(opts.test)

  if (!token) {
    const envFlag = opts.test ? ' --test' : ''
    console.error(
      `Error: Not authenticated. Run 'phq auth login --email <email> --password <password>${envFlag}' first.`
    )
    process.exit(1)
  }

  const client = axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        const status = error.response.status
        const data = error.response.data as Record<string, unknown>

        if (status === 401) {
          console.error('Error: Unauthorized. Your token may be invalid or expired. Please log in again.')
          process.exit(1)
        }

        if (status === 404) {
          console.error('Error: Resource not found.')
          process.exit(1)
        }

        if (status === 400) {
          const errors = data?.errors ?? data?.error ?? data
          console.error('Error:', JSON.stringify(errors, null, 2))
          process.exit(1)
        }

        if (status === 500) {
          const errors = data?.errors ?? data?.error ?? 'Internal server error'
          console.error('Error:', JSON.stringify(errors, null, 2))
          process.exit(1)
        }
      } else if (error.request) {
        console.error('Error: No response received from server. Check your network connection.')
        process.exit(1)
      }
      return Promise.reject(error)
    }
  )

  return client
}

/**
 * Creates an unauthenticated client — used only for auth login/logout.
 */
export function createUnauthenticatedClient(opts: ApiOptions): AxiosInstance {
  const baseURL = getBaseUrl(opts.test)
  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
}

/**
 * Converts an array of --filter "key=value" strings into a ransack `q` params object.
 * Example: ["label_cont=signup", "pinned_eq=true"] → { label_cont: "signup", pinned_eq: "true" }
 */
export function buildFilterParams(filters: string[]): Record<string, string> {
  const q: Record<string, string> = {}
  for (const f of filters) {
    const idx = f.indexOf('=')
    if (idx === -1) {
      console.error(`Error: Invalid filter "${f}". Filters must be in the format "predicate=value".`)
      process.exit(1)
    }
    const key = f.slice(0, idx).trim()
    const value = f.slice(idx + 1).trim()
    q[key] = value
  }
  return q
}
