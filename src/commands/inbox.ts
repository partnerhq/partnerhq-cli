import { Command } from 'commander'
import { createClient, withSpinner, PaginatedResponse } from '../api-client'
import { printObject, printSuccess, printBanner, printList } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

// Tree shape (Host::InboxTreePresenter): {individuals: [{label, thread, groups: {tasks:[], resources:[], internal_tasks:[]}, organizations: [...], unread, flagged}]}
// where thread = {chatChannelId, identifier, label, unread, flagged}
function walkNode(node: Record<string, unknown>, depth: number, lines: string[]): void {
  const label = (node.label || node.name || '') as string
  const unread = (node.unread ?? 0) as number
  const flagged = (node.flagged ?? false) as boolean
  const badge = [unread > 0 ? `${unread} unread` : '', flagged ? 'flagged' : ''].filter(Boolean).join(', ')
  if (label) lines.push(`${'  '.repeat(depth)}${label}${badge ? `  (${badge})` : ''}`)

  const thread = node.thread as Record<string, unknown> | undefined
  if (thread?.identifier) {
    const tBadge = [(thread.unread as number) > 0 ? `${thread.unread} unread` : '', thread.flagged ? 'flagged' : ''].filter(Boolean).join(', ')
    lines.push(`${'  '.repeat(depth + 1)}${thread.label || 'Comments'}  channel=${thread.chatChannelId}  [${thread.identifier}]${tBadge ? `  (${tBadge})` : ''}`)
  }

  const groups = node.groups as Record<string, unknown> | undefined
  if (groups) {
    for (const children of Object.values(groups)) {
      if (Array.isArray(children)) {
        for (const child of children) walkNode(child as Record<string, unknown>, depth + 1, lines)
      }
    }
  }
  const organizations = node.organizations
  if (Array.isArray(organizations)) {
    for (const org of organizations) walkNode(org as Record<string, unknown>, depth + 1, lines)
  }
}

// API::V1::Host::InboxActivityPresenter rows (camelCase keys).
const ACTIVITY_COLS = ['lastMessageAt', 'personName', 'organizationName', 'label', 'taskType', 'unread', 'flagged', 'identifier', 'chatChannelId']

export function registerInboxCommands(program: Command): void {
  const cmd = program
    .command('inbox')
    .description('Host inbox: unread/flagged conversation tree across the whole project')

  cmd
    .command('tree')
    .description('Fetch the inbox tree (individuals → orgs → tasks/resources, with unread counts)')
    .action(async (_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching inbox tree...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/host/inbox/tree`)
      )
      if (g.json) {
        printObject(response.data, { json: true })
      } else {
        const lines: string[] = []
        const individuals = (response.data as { individuals?: Record<string, unknown>[] }).individuals ?? []
        for (const individual of individuals) walkNode(individual, 0, lines)
        console.log(lines.length > 0 ? lines.join('\n') : '(inbox empty)')
      }
    })

  cmd
    .command('activity')
    .description('Flat, newest-first list of every conversation in the project')
    .option('--unread-only', 'Only unread or flagged conversations')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const params: Record<string, unknown> = { page: opts.page, per_page: opts.perPage }
      if (opts.unreadOnly) params.unread_only = true
      const response = await withSpinner('Fetching inbox activity...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/host/inbox/activity`, { params })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, ACTIVITY_COLS, { json: g.json })
    })

  cmd
    .command('flag <chat_channel_id>')
    .description('Flag a conversation as unread/needs-attention')
    .action(async (chatChannelId, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Flagging conversation...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/host/inbox/flag`, { chat_channel_id: chatChannelId })
      )
      printSuccess(`Chat channel ${chatChannelId} flagged.`)
    })

  cmd
    .command('unflag <chat_channel_id>')
    .description('Remove your flag from a conversation')
    .action(async (chatChannelId, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Unflagging conversation...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/host/inbox/unflag`, { chat_channel_id: chatChannelId })
      )
      printSuccess(`Chat channel ${chatChannelId} unflagged.`)
    })

  cmd
    .command('mark-read <identifier>')
    .description('Mark all messages in a chat channel (by identifier) as read')
    .action(async (identifier, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Marking read...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/host/inbox/mark_read`, { identifier })
      )
      printObject(response.data, { json: g.json })
    })
}
