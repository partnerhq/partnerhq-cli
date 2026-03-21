import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse } from '../api-client'
import { printList, printObject } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

const LIST_COLS = ['id', 'item_type', 'can_view', 'can_notify', 'can_edit', 'created_at']

export function registerAuthorizationsCommands(program: Command): void {
  const cmd = program
    .command('authorizations')
    .description('Manage partner permissions/authorizations within an event')

  cmd
    .command('list')
    .description('List all authorizations in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. item_type asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await client.get(
        `/api/v1/e/${event}/p/${partnership}/authorizations`,
        { params: { q, page: opts.page, per_page: opts.perPage } }
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single authorization by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/e/${event}/p/${partnership}/authorizations/${id}`)
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update a single authorization')
    .option('--can-view <bool>', 'Can view (true/false)')
    .option('--can-notify <bool>', 'Can receive notifications (true/false)')
    .option('--can-edit <bool>', 'Can edit (true/false)')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.canView !== undefined) body.can_view = opts.canView === 'true'
      if (opts.canNotify !== undefined) body.can_notify = opts.canNotify === 'true'
      if (opts.canEdit !== undefined) body.can_edit = opts.canEdit === 'true'
      const response = await client.patch(`/api/v1/e/${event}/p/${partnership}/authorizations/${id}`, { authorization: body })
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('bulk-update')
    .description('Update multiple authorizations at once')
    .requiredOption('--data <json>', 'JSON array of authorization objects with id and fields to update')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })

      let authorizations: unknown[]
      try {
        authorizations = JSON.parse(opts.data)
        if (!Array.isArray(authorizations)) throw new Error('Expected a JSON array')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Error: --data must be a valid JSON array. ${msg}`)
        process.exit(1)
      }

      const response = await client.patch(
        `/api/v1/e/${event}/p/${partnership}/authorizations/bulk_update`,
        { authorizations }
      )
      if (g.json) {
        console.log(JSON.stringify(response.data, null, 2))
      } else {
        printList(
          { collection: response.data as Record<string, unknown>[], current_page: 1, per_page: response.data.length, total_entries: response.data.length },
          LIST_COLS,
          { json: false }
        )
      }
    })
}
