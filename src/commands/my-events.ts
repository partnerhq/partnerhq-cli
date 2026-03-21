import { Command } from 'commander'
import { createClient, withSpinner, PaginatedResponse } from '../api-client'
import { printList, printBanner } from '../output'
import { getGlobalOpts } from '../global-opts'

const LIST_COLS = ['event_id', 'event_name', 'event_permalink', 'partnership_id', 'host', 'archived', 'created_at']

export function registerMyEventsCommands(program: Command): void {
  const cmd = program
    .command('my-events')
    .description('List events you belong to')

  cmd
    .command('list')
    .description('List all events the authenticated user belongs to')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching events...', () =>
        client.get('/api/v1/events/my_events', { params: { page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })
}
