import { Command } from 'commander'
import { createClient, withSpinner, PaginatedResponse } from '../api-client'
import { printList, printBanner } from '../output'
import { getGlobalOpts } from '../global-opts'

const LIST_COLS = ['organization_id', 'organization_name', 'organization_permalink', 'owner', 'current']

export function registerMyOrganizationsCommands(program: Command): void {
  const cmd = program
    .command('my-organizations')
    .description('List organizations you are a member of')

  cmd
    .command('list')
    .description('List all organizations the authenticated user is a member of')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching organizations...', () =>
        client.get('/api/v1/my_organizations', { params: { page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })
}
