import { Command } from 'commander'
import path from 'path'
import { createClient, buildFilterParams, getRedirectLocation, downloadToFile, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
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
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching task completions...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/task_completions`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
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
  cmd
    .command('download-signed-pdf <id>')
    .description('Get the signed document URL for a signature task (or save it with --output)')
    .option('--output <path>', 'Local path to save the PDF')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const url = await getRedirectLocation(
        client,
        `/api/v1/e/${event}/p/${partnership}/task_completions/${id}/download_signed_pdf`
      )
      if (!opts.output) {
        console.log(url)
        return
      }
      const outputPath = path.resolve(opts.output)
      await downloadToFile(url, outputPath)
      printSuccess(`Wrote ${outputPath}`)
    })

  for (const [cliName, apiAction, label, noteRequired] of [
    ['submit-for-approval', 'submit_for_approval', 'Submitting for approval', false],
    ['approve-submission', 'approve_submission', 'Approving submission', false],
    ['request-changes', 'request_changes', 'Requesting changes', true],
  ] as [string, string, string, boolean][]) {
    const sub = cmd
      .command(`${cliName} <id>`)
      .description(
        cliName === 'submit-for-approval'
          ? 'Submit a completed-work review request on an approval task'
          : cliName === 'approve-submission'
            ? 'Approve the pending submission (optional --note)'
            : 'Send the submission back with required change notes (--note)'
      )
      .option('--note <text>', noteRequired ? 'Feedback for the submitter (required)' : 'Optional note')
    sub.action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.note) body.note = opts.note
      const response = await withSpinner(`${label}...`, () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/task_completions/${id}/${apiAction}`, body)
      )
      printObject(response.data, { json: g.json })
    })
  }

}
