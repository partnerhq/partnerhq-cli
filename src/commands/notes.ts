import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import chalk from 'chalk'
import { Command } from 'commander'
import { createClient, createMultipartClient, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'content', 'notable_type', 'notable_id', 'partnership_id', 'created_at']
const NOTABLE_TYPES = ['Task', 'Resource', 'InternalTask', 'Partnership', 'OrganizationPartnership']

function notableOpts(cmd: Command): Command {
  return cmd
    .requiredOption('--notable-type <type>', `Parent type (${NOTABLE_TYPES.join(', ')})`)
    .requiredOption('--notable-id <id>', 'Parent record ID')
}

export function registerNotesCommands(program: Command): void {
  const cmd = program
    .command('notes')
    .description('Host-only internal notes on tasks, individuals, and organizations')

  notableOpts(
    cmd
      .command('list')
      .description('List notes on a record')
      .option('--page <n>', 'Page number', '1')
      .option('--per-page <n>', 'Results per page (max 250)', '30')
  ).action(async (opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const client = createClient({ test: g.test })
    const response = await withSpinner('Fetching notes...', () =>
      client.get(`/api/v1/e/${event}/p/${partnership}/notes`, {
        params: {
          notable_type: opts.notableType,
          notable_id: opts.notableId,
          page: opts.page,
          per_page: opts.perPage,
        },
      })
    )
    printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
  })

  notableOpts(
    cmd
      .command('create')
      .description('Add a note to a record')
      .requiredOption('--content <text>', 'The note body (HTML allowed)')
      .option('--attachment <path>', 'Local file to attach')
  ).action(async (opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const params = { notable_type: opts.notableType, notable_id: opts.notableId }

    if (opts.attachment) {
      const filePath = path.resolve(opts.attachment)
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red('✗') + ` File not found: ${filePath}`)
        process.exit(1)
      }
      const form = new FormData()
      form.append('note[content]', opts.content)
      form.append('note[attachment]', fs.createReadStream(filePath), {
        filename: path.basename(filePath),
      })
      const client = createMultipartClient({ test: g.test })
      const response = await withSpinner('Adding note...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/notes`, form, {
          headers: form.getHeaders(),
          params,
        })
      )
      printObject(response.data, { json: g.json })
      return
    }

    const client = createClient({ test: g.test })
    const response = await withSpinner('Adding note...', () =>
      client.post(`/api/v1/e/${event}/p/${partnership}/notes`, { note: { content: opts.content } }, { params })
    )
    printObject(response.data, { json: g.json })
  })

  cmd
    .command('delete <id>')
    .description('Delete a note (only your own notes)')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete note ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting note...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/notes/${id}`)
      )
      printSuccess(`Note ${id} deleted.`)
    })
}
