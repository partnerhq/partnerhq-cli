import { Command } from 'commander'
import path from 'path'
import { createClient, buildFilterParams, getRedirectLocation, downloadToFile, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner, printCounts, printExpiringUrl } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { registerApprovalActions } from '../approval-actions'
import { taskCompletionStatus, withTaskCompletionStatus } from '../task-status'

const LIST_COLS = ['id', 'task_id', 'label', 'partnerable_id', 'status', 'enabled', 'completed_at', 'due_at', 'created_at']

// SignatureRequest::SIGNED_PDF_TTL — applies to the signed PDF and the certificate.
const SIGNED_PDF_URL_TTL_SECONDS = 3600

export function registerTaskCompletionsCommands(program: Command): void {
  const cmd = program
    .command('task-completions')
    .description('Manage task completion assignments within an event')

  cmd
    .command('list')
    .description('List task completions in an event (the status column reflects approval state)')
    .option('--task-id <id>', "Only this task's assignments (supports --filter 'label_cont=<org>' and 'status_in[]=...')")
    .option('--status <status>', 'Approval queue: needs_approval or awaiting_others')
    .option('--filter <predicate=value>', "Ransack filter (repeatable). With --task-id: status_in[]=open|completed|overdue|in_review|changes_requested|not_approved", (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250; 100 with --task-id)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. due_at asc). With --task-id: activity or status')
    .option('--direction <dir>', 'Sort direction for --task-id sorts: asc or desc')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      const params: Record<string, unknown> = { q, page: opts.page, per_page: opts.perPage }
      if (opts.taskId) {
        // The task-scoped listing sorts by its own sort/direction params, not Ransack's q[s].
        params.task_id = opts.taskId
        if (opts.sort) params.sort = opts.sort
        if (opts.direction) params.direction = opts.direction
      } else if (opts.sort) {
        q.s = opts.sort
      }
      if (opts.status) params.status = opts.status
      const response = await withSpinner('Fetching task completions...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/task_completions`, { params })
      )
      const data = response.data as PaginatedResponse<Record<string, unknown>> & { counts?: unknown }
      printList(g.json ? data : withTaskCompletionStatus(data), LIST_COLS, { json: g.json })
      printCounts(data.counts, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single task completion by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching task completion...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}`)
      )
      const data = response.data as Record<string, unknown>
      printObject(g.json ? data : { status: taskCompletionStatus(data), ...data }, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update a task completion (e.g. enable/disable, change due date)')
    .option('--enabled <bool>', 'Enable or disable this assignment (true/false)')
    .option('--due-at <datetime>', 'Override due date (ISO 8601)')
    .option('--assigned-partnership-id <id>', 'Assign to a specific partnership')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.enabled !== undefined) body.enabled = opts.enabled === 'true'
      if (opts.dueAt) body.due_at = opts.dueAt
      if (opts.assignedPartnershipId) body.assigned_partnership_id = opts.assignedPartnershipId
      const response = await withSpinner('Updating task completion...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}`, { task_completion: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('complete <id>')
    .description('Mark a task completion as complete')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Completing task...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}/complete`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('reset <id>')
    .description('Reset a task completion back to incomplete')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Resetting task completion...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}/reset`)
      )
      printObject(response.data, { json: g.json })
    })
  for (const [cliName, apiAction, label] of [
    ['download-signed-pdf', 'download_signed_pdf', 'signed document'],
    ['download-certificate', 'download_certificate', 'certificate of completion'],
  ]) {
    cmd
      .command(`${cliName} <id>`)
      .description(`Get the ${label} URL for a signature task (expires in 1 hour), or save it with --output`)
      .option('--output <path>', 'Local path to save the PDF')
      .action(async (id, opts, cmd) => {
        const g = getGlobalOpts(cmd)
        printBanner(g.test, g.json)
        const { event, partnership } = requireEventAndPartnership(g)
        const client = createClient({ test: g.test })
        const url = await getRedirectLocation(
          client,
          `/api/v1/e/${event}/p/${partnership}/task_completions/${id}/${apiAction}`
        )
        if (!opts.output) {
          printExpiringUrl(url, SIGNED_PDF_URL_TTL_SECONDS, { json: g.json })
          return
        }
        const outputPath = path.resolve(opts.output)
        await downloadToFile(url, outputPath)
        printSuccess(`Wrote ${outputPath}`)
      })
  }

  registerApprovalActions(cmd, (event, partnership) => `/api/v1/e/${event}/p/${partnership}/task_completions`)
}
