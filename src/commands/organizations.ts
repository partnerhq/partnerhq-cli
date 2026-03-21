import { Command } from 'commander'
import { createClient, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printBanner } from '../output'
import { getGlobalOpts } from '../global-opts'

const LIST_COLS = ['id', 'name', 'permalink', 'owner']

export function registerOrganizationsCommands(program: Command): void {
  const cmd = program
    .command('organizations')
    .description('List organizations the authenticated user belongs to')

  cmd
    .command('list')
    .description('List all organizations you are a member of')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching organizations...', () =>
        client.get('/api/v1/organizations', { params: { page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })
}
