import { Command } from 'commander'
import chalk from 'chalk'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../../api-client'
import { printList, printObject, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'
import { htmlToText } from '../../html'
import { parseDataFlag, deepMerge } from '../../data-flag'

const LIST_COLS = ['id', 'label', 'task_id', 'enabled', 'completed_at', 'due_at', 'overdue', 'created_at']

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
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching task assignments...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/task_completions`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
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

      const description = (response.data as { task?: { description?: string } })?.task?.description

      if (g.json) {
        printObject(response.data, { json: true })
        return
      }

      // Render the table without the (potentially massive) HTML description,
      // then print the description as plain text underneath.
      const data = response.data as Record<string, unknown>
      const taskCopy = data.task ? { ...(data.task as Record<string, unknown>) } : null
      if (taskCopy) delete taskCopy.description
      const forTable = { ...data, task: taskCopy ?? data.task }
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
  for (const [cliName, apiAction, label, noteRequired] of [
    ['submit-for-approval', 'submit_for_approval', 'Submitting for approval', false],
    ['approve-submission', 'approve_submission', 'Approving submission', false],
    ['request-changes', 'request_changes', 'Requesting changes', true],
  ] as [string, string, string, boolean][]) {
    const sub = tcCmd
      .command(`${cliName} <id>`)
      .description(
        cliName === 'submit-for-approval'
          ? 'Submit a completed-work review request on an approval task'
          : cliName === 'approve-submission'
            ? 'Approve the pending submission (optional --note)'
            : 'Send the submission back with required change notes (--note)'
      )
    if (noteRequired) {
      sub.requiredOption('--note <text>', 'Feedback for the submitter (required)')
    } else {
      sub.option('--note <text>', 'Optional note')
    }
    sub.action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.note) body.note = opts.note
      const response = await withSpinner(`${label}...`, () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/partner/task_completions/${id}/${apiAction}`, body)
      )
      printObject(response.data, { json: g.json })
    })
  }

}
