import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse } from '../../api-client'
import { printList, printObject } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

const LIST_COLS = ['id', 'task_id', 'enabled', 'completed_at', 'due_at', 'assigned_partnership_id', 'created_at']

export function registerPartnerTaskCompletionsCommands(cmd: Command): void {
  const tcCmd = cmd
    .command('task-completions')
    .description("Manage your own task assignments as a partner")

  tcCmd
    .command('list')
    .description("List your task assignments")
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
        `/api/v1/e/${event}/p/${partnership}/partner/task_completions`,
        { params: { q, page: opts.page, per_page: opts.perPage } }
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  tcCmd
    .command('get <id>')
    .description("Get a single task assignment")
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}`)
      printObject(response.data, { json: g.json })
    })

  tcCmd
    .command('update <id>')
    .description("Update a task assignment")
    .option('--due-at <datetime>', 'Override due date (ISO 8601)')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.dueAt) body.due_at = opts.dueAt
      const response = await client.patch(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}`, { task_completion: body })
      printObject(response.data, { json: g.json })
    })

  tcCmd
    .command('complete <id>')
    .description("Mark your task assignment as complete")
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.post(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}/complete`)
      printObject(response.data, { json: g.json })
    })

  tcCmd
    .command('reset <id>')
    .description("Reset your task assignment back to incomplete")
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.post(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}/reset`)
      printObject(response.data, { json: g.json })
    })
}
