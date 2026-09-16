import { Command } from 'commander'
import { createClient, withSpinner, PaginatedResponse } from '../../api-client'
import { printList, printObject, printArray, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

const MESSAGE_COLS = ['id', 'created_at', 'partnership_id', 'text', 'notes']
const CHANNEL_LIST_COLS = ['identifier', 'channelable_type', 'channelable_id', 'label', 'task_completion_id', 'task_type', 'unread_count', 'flagged']

/**
 * Table rows for messages: deleted messages come back as tombstones
 * (discarded_at set, text replaced with a notice), so flag them — and edits,
 * replies and reactions — in a `notes` column.
 */
function messageRows(messages: Record<string, unknown>[]): Record<string, unknown>[] {
  return messages.map((m) => {
    const notes: string[] = []
    if (m.discarded_at) notes.push('[deleted]')
    else if (m.edited_at) notes.push('[edited]')
    const replyTo = m.reply_to as { id?: number; name?: string } | null | undefined
    if (replyTo?.id) notes.push(`reply to #${replyTo.id}${replyTo.name ? ` (${replyTo.name})` : ''}`)
    const reactions = m.reactions as { emoji: string; count: number }[] | undefined
    if (Array.isArray(reactions) && reactions.length > 0) {
      notes.push(reactions.map((r) => `${r.emoji} ${r.count}`).join(' '))
    }
    return { ...m, notes: notes.length > 0 ? notes.join(' · ') : null }
  })
}

export function registerPartnerChatCommands(cmd: Command): void {
  const chat = cmd
    .command('chat')
    .description('Chat channels you have access to as a partner')

  chat
    .command('list')
    .description("List the chat channels you have access to (your partnership's channel + your task completions' channels)")
    .option('--type <kind>', "Filter by channelable type: 'partnership', 'task_completion', or 'asset_assignment'")
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const params: Record<string, unknown> = { page: opts.page, per_page: opts.perPage }
      if (opts.type) params.type = opts.type
      const response = await withSpinner('Fetching chat channels...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/chat_channels`, { params })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, CHANNEL_LIST_COLS, { json: g.json })
    })

  chat
    .command('show <identifier>')
    .description('Show a chat channel and its latest 30 messages (deleted messages appear as tombstones)')
    .action(async (identifier, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching chat channel...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/chat_channels/${identifier}`)
      )
      if (g.json) {
        console.log(JSON.stringify(response.data, null, 2))
        return
      }
      const data = response.data as {
        chat_channel_id: string
        chat_channel_type: string
        partnerships_with_access?: Record<string, unknown>[]
        chat_channel_messages?: Record<string, unknown>[]
      }
      printObject(
        {
          chat_channel_id: data.chat_channel_id,
          chat_channel_type: data.chat_channel_type,
        },
        { json: false }
      )
      console.log('\nPartnerships with access:')
      printArray(data.partnerships_with_access ?? [], ['id', 'name'], { json: false })
      console.log('\nLatest messages:')
      printArray(messageRows(data.chat_channel_messages ?? []), MESSAGE_COLS, { json: false })
    })

  chat
    .command('messages <identifier>')
    .description('List paginated message history for a chat channel')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page', '30')
    .action(async (identifier, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching messages...', () =>
        client.get(
          `/api/v1/e/${event}/p/${partnership}/partner/chat_channels/${identifier}/messages`,
          { params: { page: opts.page, per_page: opts.perPage } }
        )
      )
      if (g.json) {
        console.log(JSON.stringify(response.data, null, 2))
        return
      }
      const data = response.data as {
        messages: Record<string, unknown>[]
        pagination: {
          current_page: number
          per_page: number
          total_entries: number
          has_more: boolean
        }
      }
      printArray(messageRows(data.messages), MESSAGE_COLS, { json: false })
      const p = data.pagination
      console.log(
        `Page ${p.current_page} · ${data.messages.length} of ${p.total_entries} total (${p.per_page} per page)` +
          (p.has_more ? ' · more pages available' : '')
      )
    })

  chat
    .command('send <identifier>')
    .description('Send a message to a chat channel')
    .requiredOption('--text <text>', 'Message body')
    .action(async (identifier, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Sending message...', () =>
        client.post(
          `/api/v1/e/${event}/p/${partnership}/partner/chat_channels/${identifier}/create_message`,
          { message: { text: opts.text } }
        )
      )
      printObject(response.data, { json: g.json })
    })
}
