import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../../api-client'
import { printList, printObject, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

const LIST_COLS = ['id', 'name', 'counterparty', 'starts_on', 'ends_on']

export function registerPartnerContractsCommands(cmd: Command): void {
  const contracts = cmd
    .command('contracts')
    .description('Contracts with your organizations, as the partner dashboard shows them')

  contracts
    .command('list')
    .description('List your contracts')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (default name asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching contracts...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/contracts`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  contracts
    .command('show <id>')
    .description('Show a contract')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching contract...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/contracts/${id}`)
      )
      printObject(response.data, { json: g.json })
    })
}
