import { Command } from 'commander'
import chalk from 'chalk'
import { createClient, withSpinner } from './api-client'
import { printObject, printBanner } from './output'
import { getGlobalOpts, requireEventAndPartnership } from './global-opts'

interface ApprovalAction {
  cliName: string
  apiAction: string
  label: string
  description: string
  noteRequired: boolean
}

const APPROVAL_ACTIONS: ApprovalAction[] = [
  {
    cliName: 'submit-for-approval',
    apiAction: 'submit_for_approval',
    label: 'Submitting for approval',
    description: 'Submit a completed-work review request on an approval task',
    noteRequired: false,
  },
  {
    cliName: 'approve-submission',
    apiAction: 'approve_submission',
    label: 'Approving submission',
    description: 'Approve the pending submission (optional --note)',
    noteRequired: false,
  },
  {
    cliName: 'request-changes',
    apiAction: 'request_changes',
    label: 'Requesting changes',
    description: 'Send the submission back with required change notes (--note)',
    noteRequired: true,
  },
  {
    cliName: 'not-approve',
    apiAction: 'not_approve_submission',
    label: 'Not approving submission',
    description: 'Mark the pending submission not approved, with a required reason (--note)',
    noteRequired: true,
  },
]

/**
 * Register the approval workflow subcommands on a task-completions command.
 * `basePath` receives the resolved event + partnership and returns the
 * task_completions collection path (host or partner).
 */
export function registerApprovalActions(
  cmd: Command,
  basePath: (event: string, partnership: string) => string
): void {
  for (const action of APPROVAL_ACTIONS) {
    cmd
      .command(`${action.cliName} <id>`)
      .description(action.description)
      .option('--note <text>', action.noteRequired ? 'Explanation for the submitter (required)' : 'Optional note')
      .action(async (id, opts, sub) => {
        const g = getGlobalOpts(sub)
        printBanner(g.test, g.json)
        const note = typeof opts.note === 'string' ? opts.note.trim() : ''
        if (action.noteRequired && !note) {
          console.error(chalk.red('✗') + ` ${action.cliName} requires ${chalk.bold('--note <text>')} explaining the decision to the submitter.`)
          process.exit(1)
        }
        const { event, partnership } = requireEventAndPartnership(g)
        const client = createClient({ test: g.test })
        const body: Record<string, unknown> = {}
        if (note) body.note = note
        const response = await withSpinner(`${action.label}...`, () =>
          client.post(`${basePath(event, partnership)}/${id}/${action.apiAction}`, body)
        )
        printObject(response.data, { json: g.json })
      })
  }
}
