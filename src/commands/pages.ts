import fs from 'fs'
import { Command } from 'commander'
import { createClient, buildFilterParams, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'title', 'slug', 'published', 'created_at']

// Page bodies are HTML, so `--content @page.html` reads it from a file.
function readContent(value: string): string {
  return value.startsWith('@') ? fs.readFileSync(value.slice(1), 'utf8') : value
}

function buildBody(opts: Record<string, string | undefined>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (opts.title) body.title = opts.title
  if (opts.content !== undefined) body.content = readContent(opts.content)
  if (opts.backgroundColor) body.background_color = opts.backgroundColor
  if (opts.fontColor) body.font_color = opts.fontColor
  if (opts.published !== undefined) body.published = opts.published === 'true'
  return body
}

export function registerPagesCommands(program: Command): void {
  const cmd = program
    .command('pages')
    .description('Manage Page Builder pages within an event (requires page_builder_enabled)')

  cmd
    .command('list')
    .description('List all pages in an event')
    .option('--filter <predicate=value>', 'Ransack filter (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .option('--sort <predicate>', 'Sort column (e.g. title asc)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const q = buildFilterParams(opts.filter)
      if (opts.sort) q.s = opts.sort
      const response = await withSpinner('Fetching pages...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/pages`, { params: { q, page: opts.page, per_page: opts.perPage } })
      )
      printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
    })

  cmd
    .command('get <slug>')
    .description('Get a single page by slug')
    .action(async (slug, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching page...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/pages/${slug}`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('create')
    .description('Create a new page (the slug is generated from the title)')
    .requiredOption('--title <title>', 'Page title')
    .option('--content <html>', 'Page body as HTML. Prefix with @ to read from a file.')
    .option('--background-color <hex>', 'Background color (e.g. #ffffff)')
    .option('--font-color <hex>', 'Text color (e.g. #212529)')
    .option('--published <bool>', 'Publish the page (true/false, default false)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Creating page...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/pages`, { page_builder_page: buildBody(opts) })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <slug>')
    .description('Update an existing page')
    .option('--title <title>', 'New title (the slug does not change)')
    .option('--content <html>', 'New body as HTML. Prefix with @ to read from a file.')
    .option('--background-color <hex>', 'New background color')
    .option('--font-color <hex>', 'New text color')
    .option('--published <bool>', 'Published (true/false)')
    .action(async (slug, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Updating page...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/pages/${slug}`, { page_builder_page: buildBody(opts) })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <slug>')
    .description('Delete a page')
    .action(async (slug, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete page ${slug}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting page...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/pages/${slug}`)
      )
      printSuccess(`Page ${slug} deleted.`)
    })
}
