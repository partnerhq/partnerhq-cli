import { Command } from 'commander'
import { createClient, withSpinner, PaginatedResponse } from '../api-client'
import { printList, printBanner } from '../output'
import { getGlobalOpts } from '../global-opts'

const LIST_COLS = ['event_id', 'event_name', 'event_permalink', 'partnership_id', 'organization_name', 'host', 'tasks', 'tasks_overdue', 'resources_count', 'archived']

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
      const data = response.data as PaginatedResponse<Record<string, unknown>>
      const rows = g.json ? data : {
        ...data,
        collection: data.collection.map((row) => ({
          ...row,
          tasks: row.tasks_assigned === undefined ? undefined : `${row.tasks_completed ?? 0}/${row.tasks_assigned}`,
        })),
      }
      printList(rows, LIST_COLS, { json: g.json })
    })
}
