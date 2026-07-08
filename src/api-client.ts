import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios'
import ora from 'ora'
import chalk from 'chalk'
import fs from 'fs'
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
          console.error(
            chalk.red('✗') + ' Resource not found.\n' +
            chalk.dim(
              '  Hint: Your --event or --partnership may be incorrect for this environment.\n' +
              "  Run 'phq whoami' to check your current context, or\n" +
              "  'phq my-events list' to find your correct event permalink and partnership ID."
            )
          )
          process.exit(1)
        }

        const errors = data?.errors ?? data?.error ?? data
        const label = status >= 500 ? 'Server error' : 'Request failed'
        console.error(chalk.red('✗') + ` ${label} (${status}):`, JSON.stringify(errors, null, 2))
        process.exit(1)
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

/**
 * Multipart-aware client. Same auth + interceptors as createClient,
 * but the Authorization header is set per request and the Content-Type
 * is left to axios so it can fill in the multipart boundary from FormData.
 */
export function createMultipartClient(opts: ApiOptions): AxiosInstance {
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
      Accept: 'application/json',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
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
          console.error(
            chalk.red('✗') + ' Resource not found.\n' +
            chalk.dim(
              '  Hint: Your --event or --partnership may be incorrect for this environment.\n' +
              "  Run 'phq whoami' to check your current context, or\n" +
              "  'phq my-events list' to find your correct event permalink and partnership ID."
            )
          )
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

/**
 * GET a path with maxRedirects: 0 and return the Location header value.
 * Used to capture signed S3 URLs from partner-uploads `show` endpoints
 * (which respond with `303 See Other`).
 *
 * Requires a client whose interceptors do NOT exit on 3xx — we intercept
 * the redirect ourselves via validateStatus.
 */
export async function getRedirectLocation(
  client: AxiosInstance,
  path: string
): Promise<string> {
  const res = await client.get(path, {
    maxRedirects: 0,
    validateStatus: (status) => status >= 200 && status < 400,
  })
  const location = (res.headers['location'] as string | undefined) ?? undefined
  if (!location) {
    console.error(chalk.red('✗') + ` Expected redirect from ${path}, got status ${res.status} with no Location header.`)
    process.exit(1)
  }
  return location
}

/**
 * Stream a remote URL (e.g. a signed S3 URL) to a local file path.
 * Uses an unauthenticated axios instance — the URL is presigned and
 * any extra Authorization header would be incorrect.
 */
export async function downloadToFile(url: string, outputPath: string): Promise<void> {
  const res = await axios.get(url, {
    responseType: 'stream',
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath)
    res.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
    res.data.on('error', reject)
  })
}
