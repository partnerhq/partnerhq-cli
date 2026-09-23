import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'
import { parseDataFlag, deepMerge } from '../data-flag'
import { registerResultsCommands } from '../results'

const LIST_COLS = ['id', 'label', 'type', 'pinned', 'locked', 'advance', 'due_at', 'published_at', 'created_at']

// Tasks::ComputedSort::SORT_KEYS — sent as ?sort=&direction= instead of Ransack's q[s].
const COMPUTED_SORTS = ['completed_count', 'assigned_count', 'views_count', 'field_count', 'has_signature', 'response_rate', 'overdue_count']

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
    .option('--sort <predicate>', `Ransack sort (e.g. "position asc"), or a computed sort: ${COMPUTED_SORTS.join(', ')}`)
    .option('--direction <dir>', 'Direction for a computed --sort: asc or desc (default: desc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      const params: Record<string, unknown> = { q, page: opts.page, per_page: opts.perPage }
      if (opts.sort && COMPUTED_SORTS.includes(opts.sort)) {
        params.sort = opts.sort
        if (opts.direction) params.direction = opts.direction
      } else if (opts.sort) {
        q.s = opts.sort
      }
      const response = await withSpinner('Fetching tasks...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/tasks`, { params })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single task by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching task...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/tasks/${id}`)
      )
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
    .option('--data <json>', 'Raw JSON body to merge with flag-built body. Prefix with @ to read from a file. Flags win on conflict.')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
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
      // Flag-built `payload` overlays the parsed --data, so flags win on conflict.
      let payload: Record<string, unknown> = { task: body }
      if (opts.data) {
        const dataPayload = parseDataFlag(opts.data)
        payload = deepMerge(dataPayload, payload)
      }
      const response = await withSpinner('Creating task...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/tasks`, payload)
      )
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
    .option('--data <json>', 'Raw JSON body to merge with flag-built body. Prefix with @ to read from a file. Flags win on conflict.')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
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
      // Flag-built `payload` overlays the parsed --data, so flags win on conflict.
      let payload: Record<string, unknown> = { task: body }
      if (opts.data) {
        const dataPayload = parseDataFlag(opts.data)
        payload = deepMerge(dataPayload, payload)
      }
      const response = await withSpinner('Updating task...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/tasks/${id}`, payload)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete (soft-delete) a task')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete task ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting task...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/tasks/${id}`)
      )
      printSuccess(`Task ${id} deleted.`)
    })
  cmd
    .command('toggle-archive <id>')
    .description('Archive or unarchive (toggles the current state)')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Toggling archive...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/tasks/${id}/toggle_archive`)
      )
      printObject(response.data, { json: g.json })
    })

  for (const [action, label] of [['publish', 'Publishing'], ['unpublish', 'Unpublishing']]) {
    cmd
      .command(`${action} <id>`)
      .description(action === 'publish'
        ? 'Publish a task so partners can see it'
        : 'Unpublish a task (back to draft, hidden from partners)')
      .action(async (id, _opts, cmd) => {
        const g = getGlobalOpts(cmd)
        printBanner(g.test, g.json)
        const { event, partnership } = requireEventAndPartnership(g)
        const client = createClient({ test: g.test })
        const response = await withSpinner(`${label} task...`, () =>
          client.post(`/api/v1/e/${event}/p/${partnership}/tasks/${id}/${action}`)
        )
        printObject(response.data, { json: g.json })
      })
  }

  registerResultsCommands(cmd, 'tasks', 'task')
}
