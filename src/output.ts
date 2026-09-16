import chalk from 'chalk'
import Table from 'cli-table3'
import { PaginatedResponse } from './api-client'

export interface PrintOptions {
  json: boolean
}

let bannerShown = false

/**
 * Print a warning banner when running in test mode.
 * Only prints once per CLI invocation and never in JSON mode.
 */
export function printBanner(test: boolean, json: boolean): void {
  if (json || bannerShown || !test) return
  bannerShown = true
  console.log(chalk.bgYellow.black(' ⚠ TEST MODE ') + chalk.yellow(' http://phq.test') + '\n')
}

/**
 * Print a single object — JSON mode or a two-column key/value table.
 */
export function printObject(obj: Record<string, unknown>, opts: PrintOptions): void {
  if (opts.json) {
    console.log(JSON.stringify(obj, null, 2))
    return
  }

  const table = new Table({
    style: { head: ['cyan'] },
    wordWrap: true,
  })

  for (const [key, value] of Object.entries(obj)) {
    const display = value === null || value === undefined
      ? chalk.dim('null')
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)
    table.push([chalk.bold(key), display])
  }

  console.log(table.toString())
}

/**
 * Print a paginated list of objects as a table, using the provided column definitions.
 */
export function printList<T extends Record<string, unknown>>(
  response: PaginatedResponse<T>,
  columns: string[],
  opts: PrintOptions
): void {
  if (opts.json) {
    console.log(JSON.stringify(response, null, 2))
    return
  }

  const { collection, current_page, per_page, total_entries } = response

  if (collection.length === 0) {
    console.log(chalk.yellow('No results found.'))
    return
  }

  const table = new Table({
    head: columns.map((c) => chalk.cyan(c)),
    style: { head: ['cyan'] },
    wordWrap: true,
  })

  for (const item of collection) {
    const row = columns.map((col) => {
      const val = item[col]
      if (val === null || val === undefined) return chalk.dim('—')
      if (typeof val === 'boolean') return val ? chalk.green('true') : chalk.red('false')
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    })
    table.push(row)
  }

  console.log(table.toString())
  console.log(
    chalk.dim(
      `Page ${current_page} · ${collection.length} of ${total_entries} total (${per_page} per page)`
    )
  )
}

/**
 * Print a plain list (non-paginated array).
 */
export function printArray<T extends Record<string, unknown>>(
  items: T[],
  columns: string[],
  opts: PrintOptions
): void {
  if (opts.json) {
    console.log(JSON.stringify(items, null, 2))
    return
  }

  if (items.length === 0) {
    console.log(chalk.yellow('No results found.'))
    return
  }

  const table = new Table({
    head: columns.map((c) => chalk.cyan(c)),
    style: { head: ['cyan'] },
    wordWrap: true,
  })

  for (const item of items) {
    const row = columns.map((col) => {
      const val = item[col]
      if (val === null || val === undefined) return chalk.dim('—')
      if (typeof val === 'boolean') return val ? chalk.green('true') : chalk.red('false')
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    })
    table.push(row)
  }

  console.log(table.toString())
}

/**
 * Print a list endpoint's `counts` block (e.g. {active: 3, needs_approval: 1})
 * as one dim line. No-op in JSON mode (the counts are already in the payload)
 * or when the server did not send counts.
 */
export function printCounts(counts: unknown, opts: PrintOptions): void {
  if (opts.json || counts === null || typeof counts !== 'object') return
  const entries = Object.entries(counts as Record<string, unknown>)
  if (entries.length === 0) return
  console.log(chalk.dim('Counts: ' + entries.map(([k, v]) => `${k} ${v}`).join(' · ')))
}

/**
 * Print a short-lived signed download URL. The URL goes to stdout (so it can
 * be piped) and the expiry warning to stderr. JSON mode prints both as one object.
 */
export function printExpiringUrl(url: string, expiresInSeconds: number, opts: PrintOptions): void {
  if (opts.json) {
    console.log(JSON.stringify({ url, expires_in_seconds: expiresInSeconds }, null, 2))
    return
  }
  const human = expiresInSeconds % 3600 === 0
    ? `${expiresInSeconds / 3600} hour${expiresInSeconds === 3600 ? '' : 's'}`
    : `${expiresInSeconds} seconds`
  console.log(url)
  console.error(chalk.yellow(`⚠ This link expires in ${human}. Use --output <path> to download the file directly.`))
}

export function printSuccess(message: string): void {
  console.log(chalk.green('✓') + ' ' + message)
}

export function printError(message: string): void {
  console.error(chalk.red('✗') + ' ' + message)
}
