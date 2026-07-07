import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { parseDataFlag, deepMerge } from '../data-flag'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'email', 'state', 'type', 'short_code', 'created_at']

export function registerInvitationsCommands(program: Command): void {
  const cmd = program
    .command('invitations')
    .description('Manage invitations within an event')

  cmd
    .command('list')
    .description('List invitations in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. created_at desc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching invitations...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/invitations`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single invitation by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching invitation...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/invitations/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Invite a person to the event (creates a partnership + emails an invitation)')
    .option('--email <email>', 'Invitee email address (required unless --memberable-id)')
    .option('--memberable-id <id>', 'Invite an EXISTING individual by partnership ID instead')
    .option('--first-name <name>', 'Invitee first name')
    .option('--last-name <name>', 'Invitee last name')
    .option('--host', 'Invite as a host (teammate) instead of a partner')
    .option('--read-only', 'Grant read-only access')
    .option('--organization <name>', 'Organization name to attach (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--data <json|@file>', 'Extra partnership attributes as JSON (merged over flags)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      if (opts.memberableId) {
        const response = await withSpinner('Sending invitation...', () =>
          client.post(`/api/v1/e/${event}/p/${partnership}/invitations`, { memberable_id: opts.memberableId })
        )
        printObject(response.data, { json: g.json })
        return
      }
      if (!opts.email) {
        console.error('Pass --email (new person) or --memberable-id (existing individual)')
        process.exit(1)
      }
      let body: Record<string, unknown> = { email: opts.email }
      if (opts.firstName) body.first_name = opts.firstName
      if (opts.lastName) body.last_name = opts.lastName
      if (opts.host) body.host = true
      if (opts.readOnly) body.read_only = true
      if (opts.organization.length > 0) body.organization_names = opts.organization
      if (opts.data) body = deepMerge(body, parseDataFlag(opts.data))
      const response = await withSpinner('Sending invitation...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/invitations`, { partnership: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('resend <id>')
    .description('Resend a pending invitation email')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Resending invitation...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/invitations/${id}/resend`)
      )
      printObject(response.data, { json: g.json })
    })
  cmd
    .command('delete <id>')
    .description('Cancel a pending invitation (the individual stays in the project)')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Cancel invitation ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Canceling invitation...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/invitations/${id}`)
      )
      printSuccess(`Invitation ${id} canceled.`)
    })

  cmd
    .command('bulk-create')
    .description('Queue invitations for every uninvited individual in the project')
    .action(async (_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit('Send invitations to every uninvited individual?')
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Queueing bulk invitations...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/invitations/bulk_create`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('bulk-resend')
    .description('Queue a re-send of every pending invitation in the project')
    .action(async (_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit('Re-send every pending invitation?')
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Queueing bulk resend...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/invitations/bulk_resend`)
      )
      printObject(response.data, { json: g.json })
    })

}
