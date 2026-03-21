import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'first_name', 'last_name', 'email', 'host', 'read_only', 'created_at']

export function registerPartnershipsCommands(program: Command): void {
  const cmd = program
    .command('partnerships')
    .description('Manage partnerships (people) within an event')

  cmd
    .command('list')
    .description('List all partnerships in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. created_at desc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching partnerships...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partnerships`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single partnership by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching partnership...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partnerships/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new partnership (invite a person)')
    .requiredOption('--first-name <name>', 'First name')
    .requiredOption('--last-name <name>', 'Last name')
    .requiredOption('--email <email>', 'Email address')
    .option('--host', 'Make this partnership a host')
    .option('--read-only', 'Make this partnership read-only')
    .option('--notes <notes>', 'Internal notes')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {
        first_name: opts.firstName,
        last_name: opts.lastName,
        email: opts.email,
      }
      if (opts.host) body.host = true
      if (opts.readOnly) body.read_only = true
      if (opts.notes) body.notes = opts.notes
      const response = await withSpinner('Creating partnership...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/partnerships`, { partnership: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update an existing partnership')
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
    .option('--email <email>', 'Email address')
    .option('--host <bool>', 'Host status (true/false)')
    .option('--read-only <bool>', 'Read-only status (true/false)')
    .option('--notes <notes>', 'Internal notes')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.firstName) body.first_name = opts.firstName
      if (opts.lastName) body.last_name = opts.lastName
      if (opts.email) body.email = opts.email
      if (opts.host !== undefined) body.host = opts.host === 'true'
      if (opts.readOnly !== undefined) body.read_only = opts.readOnly === 'true'
      if (opts.notes) body.notes = opts.notes
      const response = await withSpinner('Updating partnership...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/partnerships/${id}`, { partnership: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete a partnership')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete partnership ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting partnership...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/partnerships/${id}`)
      )
      printSuccess(`Partnership ${id} deleted.`)
    })

  cmd
    .command('retrieve')
    .description('Find or create a partnership by name and email (idempotent)')
    .requiredOption('--first-name <name>', 'First name')
    .requiredOption('--last-name <name>', 'Last name')
    .requiredOption('--email <email>', 'Email address')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body = { first_name: opts.firstName, last_name: opts.lastName, email: opts.email }
      const response = await withSpinner('Retrieving partnership...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/partnerships/retrieve`, { partnership: body })
      )
      printObject(response.data, { json: g.json })
    })
}
