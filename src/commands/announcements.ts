import fs from 'fs'
import path from 'path'
import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'text', 'segment', 'scheduled_at', 'published_at', 'created_at']

export function registerAnnouncementsCommands(program: Command): void {
  const cmd = program
    .command('announcements')
    .description('Manage announcements within an event')

  cmd
    .command('list')
    .description('List all announcements in an event')
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
      const response = await withSpinner('Fetching announcements...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/announcements`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single announcement by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching announcement...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/announcements/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new announcement')
    .requiredOption('--text <text>', 'Announcement body text')
    .option('--segment <segment>', 'Recipient segment: all, completed, incomplete, overdue (default: all)')
    .option('--scheduled-at <datetime>', 'Schedule for a future time (ISO 8601). Omit to send now.')
    .option('--notify <type>', 'Notify type: all, task, tag, organization_partnership (default: all)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {
        text: opts.text,
        schedule_now: !opts.scheduledAt,
      }
      if (opts.segment) body.segment = opts.segment
      if (opts.scheduledAt) body.scheduled_at = opts.scheduledAt
      if (opts.notify) body.notify = opts.notify
      const response = await withSpinner('Creating announcement...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/announcements`, { announcement: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update a draft announcement (sent announcements are immutable)')
    .option('--text <text>', 'New body text')
    .option('--segment <segment>', 'New recipient segment')
    .option('--scheduled-at <datetime>', 'New scheduled time (ISO 8601)')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.text) body.text = opts.text
      if (opts.segment) body.segment = opts.segment
      if (opts.scheduledAt) body.scheduled_at = opts.scheduledAt
      const response = await withSpinner('Updating announcement...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/announcements/${id}`, { announcement: body })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete an announcement')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete announcement ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting announcement...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/announcements/${id}`)
      )
      printSuccess(`Announcement ${id} deleted.`)
    })
  cmd
    .command('preview-email')
    .description('Render the announcement email HTML without saving or sending')
    .requiredOption('--text <html>', 'The announcement body (HTML)')
    .option('--output <path>', 'Save the rendered HTML to a file')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Rendering preview...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/announcements/preview_email`, {
          announcement: { text: opts.text },
        })
      )
      if (opts.output) {
        fs.writeFileSync(path.resolve(opts.output), String(response.data))
        printSuccess(`Wrote ${path.resolve(opts.output)}`)
      } else {
        console.log(String(response.data))
      }
    })

  cmd
    .command('send-test-email')
    .description('Send the rendered announcement email to yourself with a [TEST] prefix')
    .requiredOption('--text <html>', 'The announcement body (HTML)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Sending test email...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/announcements/send_test_email`, {
          announcement: { text: opts.text },
        })
      )
      printObject(response.data, { json: g.json })
    })

}
