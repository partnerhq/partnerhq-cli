import { Command } from 'commander'
import path from 'path'
import { createClient, buildFilterParams, getRedirectLocation, downloadToFile, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner, printCounts, printExpiringUrl } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { registerApprovalActions } from '../approval-actions'
import { confirmOrExit } from '../prompt'
import { taskCompletionStatus, withTaskCompletionStatus } from '../task-status'

const collect = (v: string, a: string[]) => [...a, v]

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
    .option('--status <status>', 'Approval queue: needs_approval or awaiting_others (not with --assignments; use --assignment-status)')
    .option('--filter <predicate=value>', "Ransack filter (repeatable). With --task-id: status_in[]=open|completed|overdue|in_review|changes_requested|not_approved", (v, a: string[]) => [...a, v], [] as string[])
    .option('--assignments', 'Assignments view: every assigned task/internal task with assignment_status, plus per-person counts')
    .option('--individual-id <id>', "Only this individual's (non-host partnership) completions")
    .option('--payment-status <status>', 'Payment status (repeatable): paid, deposit_paid, partially_paid, unpaid (needs --task-id)', collect, [] as string[])
    .option('--assigned-partnership-id <id>', 'Assigned-to partnership id (repeatable; --assignments)', collect, [] as string[])
    .option('--task-ids <id>', 'Task id (repeatable; --assignments)', collect, [] as string[])
    .option('--task-type <type>', 'ToDo or InternalTask (repeatable; --assignments)', collect, [] as string[])
    .option('--assignment-status <status>', 'incomplete, complete, overdue or not_approved (repeatable; --assignments)', collect, [] as string[])
    .option('--due-from <date>', 'Due on or after this date (--assignments)')
    .option('--due-to <date>', 'Due on or before this date (--assignments)')
    .option('--search <text>', 'Search text (--assignments)')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250; 100 with --task-id or --assignments)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. due_at asc). With --task-id: activity or status. With --assignments: assigned_to, task, organization, due or completed')
    .option('--direction <dir>', 'Sort direction for --task-id/--assignments sorts: asc or desc')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      const params: Record<string, unknown> = { q, page: opts.page, per_page: opts.perPage }
      if (opts.assignments) params.assignments = 1
      if (opts.individualId) params.individual_id = opts.individualId
      const lists: [string, string[]][] = [
        ['payment_status_in', opts.paymentStatus],
        ['assigned_partnership_id_in', opts.assignedPartnershipId],
        ['task_id_in', opts.taskIds],
        ['task_type_in', opts.taskType],
        ['status_in', opts.assignmentStatus],
      ]
      for (const [key, values] of lists) if (values.length > 0) q[key] = [...((q[key] as string[] | undefined) ?? []), ...values]
      if (opts.dueFrom) q.due_from = opts.dueFrom
      if (opts.dueTo) q.due_to = opts.dueTo
      if (opts.search) q.search_cont = opts.search
      if (opts.taskId || opts.assignments) {
        // The task-scoped and assignments listings sort by their own sort/direction params, not Ransack's q[s].
        if (opts.taskId) params.task_id = opts.taskId
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
    ['regenerate-signature', 'regenerate_signature', 'Regenerate the stale signature document for'],
    ['replace-signature', 'replace_signature', 'Replace the signed document with an updated one for'],
  ]) {
    cmd
      .command(`${cliName} <id>`)
      .description(`${label} a task completion (host only)`)
      .action(async (id, _opts, cmd) => {
        const g = getGlobalOpts(cmd)
        printBanner(g.test, g.json)
        const { event, partnership } = requireEventAndPartnership(g)
        const client = createClient({ test: g.test })
        const response = await withSpinner('Working...', () =>
          client.post(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}/${apiAction}`)
        )
        printObject(response.data as Record<string, unknown>, { json: g.json })
      })
  }

  const payments = cmd
    .command('offline-payments')
    .description('Record or void offline (cash, check, other) payments on a task completion')

  payments
    .command('create <taskCompletionId>')
    .description('Record an offline payment')
    .requiredOption('--amount <amount>', 'Amount (positive, at most 2 decimals)')
    .requiredOption('--method <method>', 'check, cash or other')
    .option('--reference <text>', 'Reference (e.g. check number)')
    .option('--received-on <date>', 'Date received (YYYY-MM-DD, default today)')
    .option('--note <text>', 'Note')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = { amount: opts.amount, method: opts.method }
      if (opts.reference) body.reference = opts.reference
      if (opts.receivedOn) body.received_on = opts.receivedOn
      if (opts.note) body.note = opts.note
      const response = await withSpinner('Recording payment...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}/offline_payments`, body)
      )
      printObject(response.data as Record<string, unknown>, { json: g.json })
    })

  payments
    .command('void <taskCompletionId> <orderToken>')
    .description('Void an offline payment (orderToken is the order_token returned by create)')
    .option('--reason <text>', 'Reason for voiding')
    .action(async (id, token, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Void offline payment ${token}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.reason) body.reason = opts.reason
      const response = await withSpinner('Voiding payment...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}/offline_payments/${token}/void`, body)
      )
      printObject(response.data as Record<string, unknown>, { json: g.json })
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
