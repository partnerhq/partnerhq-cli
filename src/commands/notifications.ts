import { Command } from 'commander'
import { createClient, withSpinner } from '../api-client'
import { printArray, printObject, printBanner } from '../output'
import { getGlobalOpts } from '../global-opts'
import { parseDataFlag, deepMerge } from '../data-flag'

const LIST_COLS = ['id', 'category', 'title', 'event_name', 'read_at', 'created_at']
const CATEGORIES = [
  'task_assigned', 'task_completed', 'approval_requested', 'approval_decided', 'signing_turn',
  'signature_declined', 'self_registration', 'chat_message', 'announcement', 'project_copied',
]

export function registerNotificationsCommands(program: Command): void {
  const cmd = program
    .command('notifications')
    .description('Your notifications (not event-scoped; pass --event to narrow list/read-all/dismiss-all)')

  /** Only an explicit --event narrows; a saved default event should not. */
  const scope = (c: Command): Record<string, unknown> => {
    const e = c.optsWithGlobals().event as string | undefined
    return e ? { event: e } : {}
  }

  const simple = (name: string, description: string, verb: 'post', path: string, spinner: string) =>
    cmd.command(name).description(description).action(async (_opts, c) => {
      const g = getGlobalOpts(c)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner(spinner, () => client[verb](path, null, { params: scope(c) }))
      printObject(response.data as Record<string, unknown>, { json: g.json })
    })

  cmd
    .command('list')
    .description('List notifications (newest first, cursor-paginated)')
    .option('--per-page <n>', 'Results per page')
    .option('--before <iso8601>', "Cursor: next_cursor.before from the previous page (needs --before-id)")
    .option('--before-id <id>', 'Cursor: next_cursor.before_id from the previous page')
    .action(async (opts, c) => {
      const g = getGlobalOpts(c)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const params: Record<string, unknown> = scope(c)
      if (opts.perPage) params.per_page = opts.perPage
      if (opts.before) params.before = opts.before
      if (opts.beforeId) params.before_id = opts.beforeId
      const response = await withSpinner('Fetching notifications...', () => client.get('/api/v1/notifications', { params }))
      const data = response.data as { notifications?: Record<string, unknown>[]; next_cursor?: unknown } & Record<string, unknown>
      if (g.json) return console.log(JSON.stringify(data, null, 2))
      const { notifications = [], next_cursor, ...counts } = data
      printObject(counts, { json: false })
      printArray(notifications, LIST_COLS, { json: false })
      if (next_cursor) console.log(`More: --before ${(next_cursor as Record<string, unknown>).before} --before-id ${(next_cursor as Record<string, unknown>).before_id}`)
    })

  cmd
    .command('read <ids...>')
    .description('Mark notifications as read')
    .action(async (ids, _opts, c) => {
      const g = getGlobalOpts(c)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Marking read...', () => client.post('/api/v1/notifications/mark_read', { ids }))
      printObject(response.data as Record<string, unknown>, { json: g.json })
    })

  simple('read-all', 'Mark all notifications as read', 'post', '/api/v1/notifications/mark_all_read', 'Marking all read...')
  simple('dismiss-all', 'Dismiss all notifications', 'post', '/api/v1/notifications/dismiss_all', 'Dismissing all...')

  for (const [name, verb] of [['dismiss', 'Dismiss'], ['restore', 'Restore']]) {
    cmd
      .command(`${name} <id>`)
      .description(`${verb} a notification`)
      .action(async (id, _opts, c) => {
        const g = getGlobalOpts(c)
        printBanner(g.test, g.json)
        const client = createClient({ test: g.test })
        const response = await withSpinner(`${verb}ing...`.replace('ee', 'e'), () => client.post(`/api/v1/notifications/${id}/${name}`))
        printObject(response.data as Record<string, unknown>, { json: g.json })
      })
  }

  cmd
    .command('prefs')
    .description('Show notification preferences, or update them with --set / --data')
    .option('--set <category=bool>', `Set a category on/off (repeatable). Categories: ${CATEGORIES.join(', ')}`, (v, a: string[]) => [...a, v], [] as string[])
    .option('--data <json|@file>', 'Raw notification_preferences JSON object')
    .action(async (opts, c) => {
      const g = getGlobalOpts(c)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      let prefs: Record<string, unknown> = opts.data ? parseDataFlag(opts.data) : {}
      for (const s of opts.set as string[]) {
        const [k, v] = s.split('=')
        prefs = deepMerge(prefs, { [k]: v === 'true' })
      }
      const url = '/api/v1/notifications/preferences'
      const response = await withSpinner('Working...', () =>
        Object.keys(prefs).length > 0 ? client.patch(url, { notification_preferences: prefs }) : client.get(url)
      )
      printObject(response.data as Record<string, unknown>, { json: g.json })
    })
}
