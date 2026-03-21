import chalk from 'chalk'
import Table from 'cli-table3'
import { PaginatedResponse } from './api-client'

export interface PrintOptions {
  json: boolean
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

export function printSuccess(message: string): void {
  console.log(chalk.green('✓') + ' ' + message)
}

export function printError(message: string): void {
  console.error(chalk.red('✗') + ' ' + message)
}
