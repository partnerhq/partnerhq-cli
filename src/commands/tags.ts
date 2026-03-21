import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse } from '../api-client'
import { printList, printObject, printSuccess } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

const LIST_COLS = ['id', 'name', 'hex_color', 'font_color', 'created_at']

export function registerTagsCommands(program: Command): void {
  const cmd = program
    .command('tags')
    .description('Manage tags within an event')

  cmd
    .command('list')
    .description('List all tags in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. name asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await client.get(
        `/api/v1/e/${event}/p/${partnership}/tags`,
        { params: { q, page: opts.page, per_page: opts.perPage } }
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <id>')
    .description('Get a single tag by ID')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/e/${event}/p/${partnership}/tags/${id}`)
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new tag')
    .requiredOption('--name <name>', 'Tag name')
    .option('--hex-color <hex>', 'Tag background color (e.g. #FF5733)', '#000000')
    .option('--font-color <hex>', 'Tag text color (e.g. #FFFFFF)', '#EEEEEE')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = { name: opts.name }
      if (opts.hexColor) body.hex_color = opts.hexColor
      if (opts.fontColor) body.font_color = opts.fontColor
      const response = await client.post(`/api/v1/e/${event}/p/${partnership}/tags`, { tag: body })
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Update an existing tag')
    .option('--name <name>', 'New name')
    .option('--hex-color <hex>', 'New background color')
    .option('--font-color <hex>', 'New text color')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.name) body.name = opts.name
      if (opts.hexColor) body.hex_color = opts.hexColor
      if (opts.fontColor) body.font_color = opts.fontColor
      const response = await client.patch(`/api/v1/e/${event}/p/${partnership}/tags/${id}`, { tag: body })
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete a tag')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await client.delete(`/api/v1/e/${event}/p/${partnership}/tags/${id}`)
      printSuccess(`Tag ${id} deleted.`)
    })
}
