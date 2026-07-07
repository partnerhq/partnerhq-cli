import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'name', 'host', 'archived_at', 'created_at']

export function registerOrgPartnershipsCommands(program: Command): void {
  const cmd = program
    .command('org-partnerships')
    .description('Manage organization partnerships (companies/orgs) within an event')

  cmd
    .command('list')
    .description('List all organization partnerships in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. name asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching organizations...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/organization_partnerships`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single organization partnership by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching organization...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/organization_partnerships/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new organization partnership')
    .requiredOption('--name <name>', 'Organization name')
    .option('--host', 'Mark as host organization')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = { name: opts.name }
      if (opts.host) body.host = true
      const response = await withSpinner('Creating organization...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/organization_partnerships`, { organization_partnership: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update an existing organization partnership')
    .option('--name <name>', 'New organization name')
    .option('--host <bool>', 'Host status (true/false)')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.name) body.name = opts.name
      if (opts.host !== undefined) body.host = opts.host === 'true'
      const response = await withSpinner('Updating organization...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/organization_partnerships/${id}`, { organization_partnership: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete an organization partnership')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete organization partnership ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting organization...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/organization_partnerships/${id}`)
      )
      printSuccess(`Organization partnership ${id} deleted.`)
    })

  cmd
    .command('approve <id>')
    .description('Approve a pending organization partnership')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Approving organization...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/organization_partnerships/${id}/approve`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('deny <id>')
    .description('Deny a pending organization partnership')
    .option('--reason <text>', 'Denial reason shown to the organization')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.reason) body.denial_reason = opts.reason
      const response = await withSpinner('Denying organization...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/organization_partnerships/${id}/deny`, body)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('retrieve')
    .description('Find or create an organization partnership by name (idempotent)')
    .requiredOption('--name <name>', 'Organization name')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Retrieving organization...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/organization_partnerships/retrieve`, { organization_partnership: { name: opts.name } })
      )
      printObject(response.data, { json: g.json })
    })
}
