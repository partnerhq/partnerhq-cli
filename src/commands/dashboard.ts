import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

const LIST_COLS = ['id', 'task_type', 'label', 'task_id', 'enabled', 'completed_at', 'due_at', 'overdue', 'created_at']

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description("Your dashboard for the current event — task completions assigned to you (ToDos, Resources, and Internal Tasks)")
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. due_at asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching dashboard...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/task_completions`, {
          params: { q, page: opts.page, per_page: opts.perPage, type: 'all' },
        })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })
}
