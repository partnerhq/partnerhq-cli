import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse } from '../api-client'
import { printList, printObject } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

const LIST_COLS = ['id', 'name', 'text', 'welcome_message', 'created_at']

export function registerMessagesCommands(program: Command): void {
  const cmd = program
    .command('messages')
    .description('Read messages (chat) within an event (read-only)')

  cmd
    .command('list')
    .description('List messages in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. created_at desc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await client.get(
        `/api/v1/e/${event}/p/${partnership}/messages`,
        { params: { q, page: opts.page, per_page: opts.perPage } }
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single message by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/e/${event}/p/${partnership}/messages/${id}`)
      printObject(response.data, { json: g.json })
    })
}
