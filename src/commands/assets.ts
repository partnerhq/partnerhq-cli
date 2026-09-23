import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'name']
const TASK_IDS_HELP = 'Comma-separated IDs of tasks, resources, or internal tasks to link'

function parseTaskIds(value: string): number[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean).map(Number)
}

export function registerAssetsCommands(program: Command): void {
  const cmd = program
    .command('assets')
    .description('Manage project assets within an event (requires enable_assets)')

  cmd
    .command('list')
    .description('List all assets in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. name desc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching assets...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/assets`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single asset by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching asset...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/assets/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new asset (every organization in the event gets an assignment)')
    .requiredOption('--name <name>', 'Asset name')
    .option('--task-ids <ids>', TASK_IDS_HELP)
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = { name: opts.name }
      if (opts.taskIds !== undefined) body.task_ids = parseTaskIds(opts.taskIds)
      const response = await withSpinner('Creating asset...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/assets`, { asset: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update an existing asset')
    .option('--name <name>', 'New name')
    .option('--task-ids <ids>', `${TASK_IDS_HELP}; replaces the current links ("" unlinks all)`)
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.name) body.name = opts.name
      if (opts.taskIds !== undefined) body.task_ids = parseTaskIds(opts.taskIds)
      const response = await withSpinner('Updating asset...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/assets/${id}`, { asset: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete an asset and its organization assignments')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete asset ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting asset...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/assets/${id}`)
      )
      printSuccess(`Asset ${id} deleted.`)
    })
}
