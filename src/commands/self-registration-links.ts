import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'
import { parseDataFlag, deepMerge } from '../data-flag'

const LIST_COLS = ['id', 'name', 'token', 'require_approval', 'limit', 'created_at']

function buildBody(opts: Record<string, unknown>): Record<string, unknown> {
  let body: Record<string, unknown> = {}
  if (opts.name) body.name = opts.name
  if (opts.joinOrg) body.join_organization_partnership_id = opts.joinOrg
  if (opts.askOrganizationName !== undefined) body.ask_organization_name = opts.askOrganizationName === 'true'
  if (opts.requireApproval !== undefined) body.require_approval = opts.requireApproval === 'true'
  if (opts.notifyHosts !== undefined) body.notify_hosts = opts.notifyHosts === 'true'
  if (opts.limit !== undefined) body.limit = opts.limit
  if (opts.blurb) body.text_blurb = opts.blurb
  if (opts.data) body = deepMerge(body, parseDataFlag(opts.data as string))
  return body
}

function formOpts(cmd: Command): Command {
  return cmd
    .option('--join-org <id>', 'Organization new registrants join')
    .option('--ask-organization-name <bool>', 'Ask registrants for an organization name (true/false)')
    .option('--require-approval <bool>', 'Hold registrations for host approval (true/false)')
    .option('--notify-hosts <bool>', 'Email hosts on each registration (true/false)')
    .option('--limit <n>', 'Maximum registrations (blank for unlimited)')
    .option('--blurb <text>', 'Intro text shown on the sign-up page')
    .option('--data <json|@file>', 'Extra attributes as JSON (merged over flags, e.g. tag_ids)')
}

export function registerSelfRegistrationLinksCommands(program: Command): void {
  const cmd = program
    .command('self-registration-links')
    .description('Shareable sign-up links (Settings → Self Registration)')

  cmd
    .command('list')
    .description('List self registration links')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      const response = await withSpinner('Fetching links...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/self_registration_links`, {
          params: { q, page: opts.page, per_page: opts.perPage },
        })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a self registration link (public URL is /e/<event>/t/<token>)')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching link...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/self_registration_links/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  formOpts(
    cmd.command('create').description('Create a self registration link').requiredOption('--name <name>', 'Internal name')
  ).action(async (opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const client = createClient({ test: g.test })
    const response = await withSpinner('Creating link...', () =>
      client.post(`/api/v1/e/${event}/p/${partnership}/self_registration_links`, {
        self_registration_link: buildBody(opts),
      })
    )
    printObject(response.data, { json: g.json })
  })

  formOpts(
    cmd.command('update <id>').description('Update a self registration link').option('--name <name>', 'Internal name')
  ).action(async (id, opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const client = createClient({ test: g.test })
    const response = await withSpinner('Updating link...', () =>
      client.patch(`/api/v1/e/${event}/p/${partnership}/self_registration_links/${id}`, {
        self_registration_link: buildBody(opts),
      })
    )
    printObject(response.data, { json: g.json })
  })

  cmd
    .command('delete <id>')
    .description('Delete a self registration link')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete self registration link ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting link...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/self_registration_links/${id}`)
      )
      printSuccess(`Self registration link ${id} deleted.`)
    })
}
