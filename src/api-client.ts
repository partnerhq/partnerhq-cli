import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios'
import ora from 'ora'
import chalk from 'chalk'
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
    const loginCmd = opts.test
      ? chalk.cyan("'phq auth login --test'")
      : chalk.cyan("'phq auth login'")
    console.error(chalk.red('✗') + ` Not authenticated. Run ${loginCmd} first.`)
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
          const loginCmd = opts.test ? "'phq auth login --test'" : "'phq auth login'"
          console.error(chalk.red('✗') + ` Unauthorized. Run ${chalk.cyan(loginCmd)} to re-authenticate.`)
          process.exit(1)
        }

        if (status === 404) {
          console.error(chalk.red('✗') + ' Resource not found.')
          process.exit(1)
        }

        if (status === 400) {
          const errors = data?.errors ?? data?.error ?? data
          console.error(chalk.red('✗') + ' Bad request:', JSON.stringify(errors, null, 2))
          process.exit(1)
        }

        if (status === 500) {
          const errors = data?.errors ?? data?.error ?? 'Internal server error'
          console.error(chalk.red('✗') + ' Server error:', JSON.stringify(errors, null, 2))
          process.exit(1)
        }
      } else if (error.request) {
        if (opts.test && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
          console.error(
            chalk.red('✗') +
            ` Could not connect to ${chalk.bold('http://phq.test')}. Is your local server running?`
          )
        } else {
          console.error(chalk.red('✗') + ' No response received from server. Check your network connection.')
        }
        process.exit(1)
      }
      return Promise.reject(error)
    }
  )

  return client
}

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
 * Wrap an async API call with a loading spinner.
 * The spinner shows `message` while loading, a checkmark on success,
 * and stops silently on failure (the error interceptor handles output).
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<AxiosResponse<T>>
): Promise<AxiosResponse<T>> {
  const spinner = ora(message).start()
  try {
    const result = await fn()
    spinner.succeed()
    return result
  } catch (err) {
    spinner.stop()
    throw err
  }
}

export function buildFilterParams(filters: string[]): Record<string, string> {
  const q: Record<string, string> = {}
  for (const f of filters) {
    const idx = f.indexOf('=')
    if (idx === -1) {
      console.error(chalk.red('✗') + ` Invalid filter "${f}". Filters must be in the format "predicate=value".`)
      process.exit(1)
    }
    const key = f.slice(0, idx).trim()
    const value = f.slice(idx + 1).trim()
    q[key] = value
  }
  return q
}
