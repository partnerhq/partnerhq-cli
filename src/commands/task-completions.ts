import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse } from '../api-client'
import { printList, printObject } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

const LIST_COLS = ['id', 'task_id', 'partnerable_type', 'partnerable_id', 'enabled', 'completed_at', 'due_at', 'created_at']

export function registerTaskCompletionsCommands(program: Command): void {
  const cmd = program
    .command('task-completions')
    .description('Manage task completion assignments within an event')

  cmd
    .command('list')
    .description('List all task completions in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. due_at asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await client.get(
        `/api/v1/e/${event}/p/${partnership}/task_completions`,
        { params: { q, page: opts.page, per_page: opts.perPage } }
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single task completion by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}`)
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update a task completion (e.g. enable/disable, change due date)')
    .option('--enabled <bool>', 'Enable or disable this assignment (true/false)')
    .option('--due-at <datetime>', 'Override due date (ISO 8601)')
    .option('--assigned-partnership-id <id>', 'Assign to a specific partnership')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.enabled !== undefined) body.enabled = opts.enabled === 'true'
      if (opts.dueAt) body.due_at = opts.dueAt
      if (opts.assignedPartnershipId) body.assigned_partnership_id = opts.assignedPartnershipId
      const response = await client.patch(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}`, { task_completion: body })
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('complete <id>')
    .description('Mark a task completion as complete')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.post(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}/complete`)
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('reset <id>')
    .description('Reset a task completion back to incomplete')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.post(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}/reset`)
      printObject(response.data, { json: g.json })
    })
}
