import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'
import { parseDataFlag, deepMerge } from '../data-flag'

function parseIdList(value: string): number[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s)
      if (!Number.isInteger(n)) {
        console.error(`✗ Invalid id "${s}" in list — expected an integer.`)
        process.exit(1)
      }
      return n
    })
}

const LIST_COLS = ['id', 'label', 'pinned', 'locked', 'due_at', 'published_at', 'created_at']

export function registerInternalTasksCommands(program: Command): void {
  const cmd = program
    .command('internal-tasks')
    .description('Manage internal tasks (host-only tasks) within an event')

  cmd
    .command('list')
    .description('List all internal tasks in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. position asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching internal tasks...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/internal_tasks`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single internal task by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching internal task...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/internal_tasks/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new internal task')
    .requiredOption('--label <label>', 'Task label/title')
    .option('--description <text>', 'Task description')
    .option('--due-at <datetime>', 'Due date (ISO 8601)')
    .option('--pinned', 'Pin this task')
    .option('--locked', 'Lock this task')
    .option('--auto-assign-to-partnership-id <id>', 'Host team-member partnership ID to auto-assign')
    .option('--assign-now-to-partnership-id <id>', 'Host team-member partnership ID to assign immediately')
    .option('--task-ids <id,id,...>', 'Comma-separated triggering task IDs')
    .option('--referenced-task-ids <id,id,...>', 'Comma-separated referenced task IDs')
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
      if (opts.autoAssignToPartnershipId) body.auto_assign_to_partnership_id = Number(opts.autoAssignToPartnershipId)
      if (opts.assignNowToPartnershipId) body.assign_now_to_partnership_id = Number(opts.assignNowToPartnershipId)
      if (opts.taskIds) body.task_ids = parseIdList(opts.taskIds)
      if (opts.referencedTaskIds) body.referenced_task_ids = parseIdList(opts.referencedTaskIds)
      let payload: Record<string, unknown> = { internal_task: body }
      if (opts.data) {
        const overlay = parseDataFlag(opts.data)
        payload = deepMerge(overlay, payload)
      }
      const response = await withSpinner('Creating internal task...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/internal_tasks`, payload)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update an existing internal task')
    .option('--label <label>', 'New label')
    .option('--description <text>', 'New description')
    .option('--due-at <datetime>', 'New due date (ISO 8601)')
    .option('--pinned <bool>', 'Pinned (true/false)')
    .option('--locked <bool>', 'Locked (true/false)')
    .option('--auto-assign-to-partnership-id <id>', 'Host team-member partnership ID to auto-assign')
    .option('--assign-now-to-partnership-id <id>', 'Host team-member partnership ID to assign immediately')
    .option('--task-ids <id,id,...>', 'Comma-separated triggering task IDs (replaces existing)')
    .option('--referenced-task-ids <id,id,...>', 'Comma-separated referenced task IDs (replaces existing)')
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
      if (opts.autoAssignToPartnershipId) body.auto_assign_to_partnership_id = Number(opts.autoAssignToPartnershipId)
      if (opts.assignNowToPartnershipId) body.assign_now_to_partnership_id = Number(opts.assignNowToPartnershipId)
      if (opts.taskIds) body.task_ids = parseIdList(opts.taskIds)
      if (opts.referencedTaskIds) body.referenced_task_ids = parseIdList(opts.referencedTaskIds)
      let payload: Record<string, unknown> = { internal_task: body }
      if (opts.data) {
        const overlay = parseDataFlag(opts.data)
        payload = deepMerge(overlay, payload)
      }
      const response = await withSpinner('Updating internal task...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/internal_tasks/${id}`, payload)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete (soft-delete) an internal task')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete internal task ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting internal task...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/internal_tasks/${id}`)
      )
      printSuccess(`Internal task ${id} deleted.`)
    })
}
