import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse } from '../../api-client'
import { printList, printObject } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

const LIST_COLS = ['id', 'name', 'host', 'archived_at', 'created_at']

export function registerPartnerOrgPartnershipsCommands(cmd: Command): void {
  const orgCmd = cmd
    .command('org-partnerships')
    .description("List your own organization partnerships (read-only)")

  orgCmd
    .command('list')
    .description("List organizations you belong to")
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. name asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await client.get(
        `/api/v1/e/${event}/p/${partnership}/partner/organization_partnerships`,
        { params: { q, page: opts.page, per_page: opts.perPage } }
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  orgCmd
    .command('get <id>')
    .description("Get a single organization you belong to")
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/e/${event}/p/${partnership}/partner/organization_partnerships/${id}`)
      printObject(response.data, { json: g.json })
    })
}
