import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'label', 'go_to_link', 'pinned', 'locked', 'published_at', 'created_at']

export function registerResourcesCommands(program: Command): void {
  const cmd = program
    .command('resources')
    .description('Manage resources within an event')

  cmd
    .command('list')
    .description('List all resources in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. position asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching resources...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/resources`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single resource by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching resource...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/resources/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new resource')
    .requiredOption('--label <label>', 'Resource label/title')
    .option('--description <text>', 'Resource description')
    .option('--go-to-link <url>', 'URL for this resource')
    .option('--go-to-link-instructions <text>', 'Instructions for the link')
    .option('--pinned', 'Pin this resource')
    .option('--locked', 'Lock this resource')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = { label: opts.label }
      if (opts.description) body.description = opts.description
      if (opts.goToLink) body.go_to_link = opts.goToLink
      if (opts.goToLinkInstructions) body.go_to_link_instructions = opts.goToLinkInstructions
      if (opts.pinned) body.pinned = true
      if (opts.locked) body.locked = true
      const response = await withSpinner('Creating resource...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/resources`, { resource: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update an existing resource')
    .option('--label <label>', 'New label')
    .option('--description <text>', 'New description')
    .option('--go-to-link <url>', 'New URL')
    .option('--go-to-link-instructions <text>', 'New instructions')
    .option('--pinned <bool>', 'Pinned (true/false)')
    .option('--locked <bool>', 'Locked (true/false)')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.label) body.label = opts.label
      if (opts.description) body.description = opts.description
      if (opts.goToLink) body.go_to_link = opts.goToLink
      if (opts.goToLinkInstructions) body.go_to_link_instructions = opts.goToLinkInstructions
      if (opts.pinned !== undefined) body.pinned = opts.pinned === 'true'
      if (opts.locked !== undefined) body.locked = opts.locked === 'true'
      const response = await withSpinner('Updating resource...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/resources/${id}`, { resource: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete (soft-delete) a resource')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete resource ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting resource...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/resources/${id}`)
      )
      printSuccess(`Resource ${id} deleted.`)
    })
}
