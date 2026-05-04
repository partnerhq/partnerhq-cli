import { Command } from 'commander'
import { createClient, withSpinner } from '../../api-client'
import { printObject, printArray, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

const MESSAGE_COLS = ['id', 'created_at', 'partnership_id', 'text']

export function registerPartnerChatCommands(cmd: Command): void {
  const chat = cmd
    .command('chat')
    .description('Chat channels you have access to as a partner')

  chat
    .command('show <identifier>')
    .description('Show a chat channel and its latest 30 messages')
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
      printArray(data.chat_channel_messages ?? [], MESSAGE_COLS, { json: false })
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
      printArray(data.messages, MESSAGE_COLS, { json: false })
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
