import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

const LIST_COLS = ['id', 'name', 'counterparty', 'starts_on', 'ends_on', 'ae_name', 'rep_name', 'import_status']

export function registerContractsCommands(program: Command): void {
  const cmd = program
    .command('contracts')
    .description('View contracts and fulfil their line items (host)')

  cmd
    .command('list')
    .description('List contracts in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. name asc; default created_at desc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching contracts...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/contracts`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('show <id>')
    .description('Show a contract with its line items')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching contract...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/contracts/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('toggle-line-item <contractId> <lineItemId>')
    .description('Toggle a contract line item between pending and fulfilled')
    .action(async (contractId, lineItemId, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Toggling line item...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/contracts/${contractId}/line_items/${lineItemId}/toggle_status`)
      )
      printObject(response.data, { json: g.json })
      if (!g.json) printSuccess(`Line item ${lineItemId} toggled.`)
    })
}
