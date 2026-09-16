import { Command } from 'commander'
import chalk from 'chalk'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../../api-client'
import { printList, printObject, printBanner, printCounts } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'
import { htmlToText } from '../../html'
import { parseDataFlag, deepMerge } from '../../data-flag'
import { registerApprovalActions } from '../../approval-actions'
import { taskCompletionStatus, withTaskCompletionStatus } from '../../task-status'

const LIST_COLS = ['id', 'label', 'task_id', 'status', 'completed_at', 'due_at', 'overdue', 'created_at']

/**
 * Options shared by `partner task-completions list` and `dashboard` — both hit
 * the partner task_completions index.
 */
export function addPartnerTaskCompletionListOptions(cmd: Command, defaultType?: string): Command {
  return cmd
    .option('--status <status>', 'Tab: active (default), assigned_to_me, needs_approval, awaiting_others, archived')
    .option('--type <type>', `Task kind: tasks, resources, internal_tasks (hosts only), all (default: ${defaultType ?? 'tasks'})`)
    .option('--organization <id>', 'Only this organization partnership id (ignored by the API if it is not one of yours)')
    .option('--asset-assignment <id>', 'Only completions for this asset assignment (integer id)')
}

export function partnerTaskCompletionListParams(opts: Record<string, string | undefined>, defaultType?: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  const type = opts.type ?? defaultType
  // The API treats any value other than resources/internal_tasks/all as ToDos.
  if (type && type !== 'tasks') params.type = type
  if (opts.status) params.status = opts.status
  if (opts.organization) params.organization_partnership_id = opts.organization
  if (opts.assetAssignment) params.asset_assignment_id = opts.assetAssignment
  return params
}

export function registerPartnerTaskCompletionsCommands(cmd: Command): void {
  const tcCmd = cmd
    .command('task-completions')
    .description("Manage your own task assignments as a partner")

  const list = tcCmd
    .command('list')
    .description("List your task assignments (the status column reflects approval state)")
  addPartnerTaskCompletionListOptions(list)
  list
    .option('--filter <predicate=value>', 'Ransack filter (repeatable; currently ignored by the partner endpoint — use --status/--type)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (currently ignored by the partner endpoint, which uses a fixed order)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching task assignments...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/task_completions`, {
          params: { q, page: opts.page, per_page: opts.perPage, ...partnerTaskCompletionListParams(opts) },
        })
      )
      const data = response.data as PaginatedResponse<Record<string, unknown>> & { counts?: unknown }
      printList(g.json ? data : withTaskCompletionStatus(data), LIST_COLS, { json: g.json })
      printCounts(data.counts, { json: g.json })
    })

  tcCmd
    .command('get <id>')
    .description("Get a single task assignment")
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching task assignment...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}`)
      )

      if (g.json) {
        printObject(response.data, { json: true })
        return
      }

      // Render the table without the (potentially massive) HTML descriptions,
      // then print the description as plain text underneath. Prefer the
      // rendered description (sanitized + tag-targeted copy) over the raw column.
      const data = response.data as Record<string, unknown>
      const task = data.task as { description?: string | null; rendered_description?: string | null } | undefined
      const description = task?.rendered_description || task?.description
      const taskCopy = task ? { ...(task as Record<string, unknown>) } : null
      if (taskCopy) {
        delete taskCopy.description
        delete taskCopy.rendered_description
      }
      const forTable = { status: taskCompletionStatus(data), ...data, task: taskCopy ?? data.task }
      printObject(forTable, { json: false })

      if (description) {
        console.log('\n' + chalk.bold.cyan('Description'))
        console.log(htmlToText(description))
      }
    })

  tcCmd
    .command('update <id>')
    .description("Update a task assignment")
    .option('--due-at <datetime>', 'Override due date (ISO 8601)')
    .option('--data <json>', "Power-user: extra task_completion attributes as JSON or @file (e.g. custom_field_values_attributes)")
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      let body: Record<string, unknown> = {}
      if (opts.dueAt) body.due_at = opts.dueAt
      if (opts.data) body = deepMerge(body, parseDataFlag(opts.data))
      const response = await withSpinner('Updating task assignment...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}`, { task_completion: body })
      )
      printObject(response.data, { json: g.json })
    })

  tcCmd
    .command('complete <id>')
    .description("Mark your task assignment as complete")
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Completing task...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}/complete`)
      )
      printObject(response.data, { json: g.json })
    })

  tcCmd
    .command('reset <id>')
    .description("Reset your task assignment back to incomplete")
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Resetting task assignment...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}/reset`)
      )
      printObject(response.data, { json: g.json })
    })

  registerApprovalActions(tcCmd, (event, partnership) => `/api/v1/e/${event}/p/${partnership}/partner/task_completions`)
}
