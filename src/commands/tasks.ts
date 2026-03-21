import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse } from '../api-client'
import { printList, printObject, printSuccess } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

const LIST_COLS = ['id', 'label', 'type', 'pinned', 'locked', 'advance', 'due_at', 'published_at', 'created_at']

export function registerTasksCommands(program: Command): void {
  const cmd = program
    .command('tasks')
    .description('Manage tasks (to-dos) within an event')

  cmd
    .command('list')
    .description('List all tasks in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. position asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await client.get(
        `/api/v1/e/${event}/p/${partnership}/tasks`,
        { params: { q, page: opts.page, per_page: opts.perPage } }
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single task by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/e/${event}/p/${partnership}/tasks/${id}`)
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new task')
    .requiredOption('--label <label>', 'Task label/title')
    .option('--description <text>', 'Task description')
    .option('--due-at <datetime>', 'Due date (ISO 8601)')
    .option('--pinned', 'Pin this task')
    .option('--locked', 'Lock this task')
    .option('--advance', 'Mark as an advance task')
    .option('--notify-hosts', 'Notify hosts on completion')
    .option('--go-to-link <url>', 'Go-to link URL')
    .option('--go-to-link-instructions <text>', 'Instructions for the go-to link')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = { label: opts.label }
      if (opts.description) body.description = opts.description
      if (opts.dueAt) body.due_at = opts.dueAt
      if (opts.pinned) body.pinned = true
      if (opts.locked) body.locked = true
      if (opts.advance) body.advance = true
      if (opts.notifyHosts) body.notify_hosts_on_completion = true
      if (opts.goToLink) body.go_to_link = opts.goToLink
      if (opts.goToLinkInstructions) body.go_to_link_instructions = opts.goToLinkInstructions
      const response = await client.post(`/api/v1/e/${event}/p/${partnership}/tasks`, { task: body })
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update an existing task')
    .option('--label <label>', 'New label')
    .option('--description <text>', 'New description')
    .option('--due-at <datetime>', 'New due date (ISO 8601)')
    .option('--pinned <bool>', 'Pinned (true/false)')
    .option('--locked <bool>', 'Locked (true/false)')
    .option('--advance <bool>', 'Advance (true/false)')
    .option('--notify-hosts <bool>', 'Notify hosts on completion (true/false)')
    .option('--go-to-link <url>', 'Go-to link URL')
    .option('--go-to-link-instructions <text>', 'Instructions for the go-to link')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.label) body.label = opts.label
      if (opts.description) body.description = opts.description
      if (opts.dueAt) body.due_at = opts.dueAt
      if (opts.pinned !== undefined) body.pinned = opts.pinned === 'true'
      if (opts.locked !== undefined) body.locked = opts.locked === 'true'
      if (opts.advance !== undefined) body.advance = opts.advance === 'true'
      if (opts.notifyHosts !== undefined) body.notify_hosts_on_completion = opts.notifyHosts === 'true'
      if (opts.goToLink) body.go_to_link = opts.goToLink
      if (opts.goToLinkInstructions) body.go_to_link_instructions = opts.goToLinkInstructions
      const response = await client.patch(`/api/v1/e/${event}/p/${partnership}/tasks/${id}`, { task: body })
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete (soft-delete) a task')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await client.delete(`/api/v1/e/${event}/p/${partnership}/tasks/${id}`)
      printSuccess(`Task ${id} deleted.`)
    })
}
