import { Command } from 'commander'
import chalk from 'chalk'
import { createClient, withSpinner } from './api-client'
import { printArray, printBanner, printSuccess } from './output'
import { getGlobalOpts, requireEventAndPartnership } from './global-opts'
import { parseDataFlag } from './data-flag'

interface ResultsColumn {
  title: string
  data: string
  type?: string
  readOnly?: boolean
  checkboxGroupOptions?: string[]
}

interface ResultsGrid {
  columns: ResultsColumn[]
  data: Record<string, unknown>[]
}

interface ResultsChange {
  task_completion_id: number
  custom_field_id: number
  value: unknown
}

const FIELD_PREFIX = 'custom-field-'

/**
 * `<task_completion_id>:<custom_field_id>=<value>` → a change, coerced the way
 * the web Results grid does (TaskGrid.jsx): checkboxes send "1"/"0", checkbox
 * groups send an array split on commas (or a JSON array).
 */
export function parseSetFlag(raw: string, columns: ResultsColumn[]): ResultsChange {
  const match = raw.match(/^(\d+):(\d+)=([\s\S]*)$/)
  if (!match) fail(`--set "${raw}": expected <task_completion_id>:<custom_field_id>=<value>`)
  const [, taskCompletionId, customFieldId, value] = match

  const column = columns.find((c) => c.data === `${FIELD_PREFIX}${customFieldId}`)
  if (!column) fail(`--set "${raw}": custom field ${customFieldId} is not a column in this results grid`)
  if (column.readOnly) fail(`--set "${raw}": the "${column.title}" column is read-only for you`)

  return {
    task_completion_id: Number(taskCompletionId),
    custom_field_id: Number(customFieldId),
    value: coerceValue(value, column),
  }
}

function coerceValue(value: string, column: ResultsColumn): unknown {
  if (column.type === 'checkbox') {
    return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase()) ? '1' : '0'
  }
  if (column.checkboxGroupOptions) {
    if (value.trim().startsWith('[')) return JSON.parse(value)
    return value.split(',').map((v) => v.trim()).filter(Boolean)
  }
  return value
}

function fail(message: string): never {
  console.error(chalk.red('✗') + ' ' + message)
  process.exit(1)
}

function printGrid(grid: ResultsGrid, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(grid, null, 2))
    return
  }

  const fieldColumns = grid.columns.filter((c) => c.data.startsWith(FIELD_PREFIX))
  const headers = ['task_completion_id', 'organization', 'completed_at',
    ...fieldColumns.map((c) => `${c.title} [${c.data.slice(FIELD_PREFIX.length)}]`)]

  const rows = grid.data.map((row) => {
    const out: Record<string, unknown> = {
      task_completion_id: row.task_completion_id,
      organization: row.organization,
      completed_at: row.completed_at,
    }
    fieldColumns.forEach((c, i) => { out[headers[i + 3]] = row[c.data] })
    return out
  })

  printArray(rows, headers, { json: false })
  if (fieldColumns.some((c) => c.readOnly)) {
    console.log(chalk.dim('Custom field columns are read-only for you (needs the "make updates via the task results view" host permission).'))
  } else if (fieldColumns.length > 0) {
    console.log(chalk.dim('Field ids are in [brackets]. Edit with: results-update <id> --set <task_completion_id>:<field_id>=<value>'))
  }
}

/**
 * Adds `results <id>` and `results-update <id>` to a tasks/resources command group.
 * `collection` is the API path segment (`tasks` or `resources`).
 */
export function registerResultsCommands(cmd: Command, collection: 'tasks' | 'resources', noun: string): void {
  cmd
    .command('results <id>')
    .description(`Show the Results grid for a ${noun}: one row per organization, one column per custom field`)
    .action(async (id, _opts, sub) => {
      const g = getGlobalOpts(sub)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching results...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/${collection}/${id}/results`)
      )
      printGrid(response.data as ResultsGrid, g.json)
    })

  cmd
    .command('results-update <id>')
    .description(`Fill in cells of a ${noun}'s Results grid (all changes apply together or not at all)`)
    .option('--set <tc:field=value>', 'Set one cell: <task_completion_id>:<custom_field_id>=<value> (repeatable). Checkbox: true/false; checkbox group: comma-separated', (v, a: string[]) => [...a, v], [] as string[])
    .option('--data <json>', 'Raw body as JSON or @file: {"changes":[{"task_completion_id":1,"custom_field_id":2,"value":"x"}]}')
    .action(async (id, opts, sub) => {
      const g = getGlobalOpts(sub)
      printBanner(g.test, g.json)
      if (opts.set.length === 0 && !opts.data) fail('Pass at least one --set or --data')

      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const path = `/api/v1/e/${event}/p/${partnership}/${collection}/${id}/results`

      const changes: unknown[] = []
      if (opts.data) {
        const data = parseDataFlag(opts.data)
        if (!Array.isArray(data.changes)) fail('--data: expected {"changes": [...]}')
        changes.push(...data.changes)
      }
      if (opts.set.length > 0) {
        const current = await withSpinner('Fetching results...', () => client.get(path))
        const { columns } = current.data as ResultsGrid
        changes.push(...(opts.set as string[]).map((raw) => parseSetFlag(raw, columns)))
      }

      const response = await withSpinner('Updating results...', () => client.patch(path, { changes }))
      if (!g.json) printSuccess(`Updated ${changes.length} cell${changes.length === 1 ? '' : 's'}.`)
      printGrid(response.data as ResultsGrid, g.json)
    })
}
