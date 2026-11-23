import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import chalk from 'chalk'
import { Command } from 'commander'
import { createClient, createMultipartClient, withSpinner } from '../api-client'
import { printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'
import { parseDataFlag, deepMerge } from '../data-flag'

const DATA_HELP =
  'Extra floor plan fields as JSON or @file, merged over flags (e.g. status_colors {"option":"color"})'

function fileOrExit(p: string): string {
  const full = path.resolve(p)
  if (!fs.existsSync(full)) {
    console.error(chalk.red('✗') + ` File not found: ${full}`)
    process.exit(1)
  }
  return full
}

// Appends scalars as `key=value`, objects as `key[sub]=value` (Rails form encoding).
function appendFields(form: FormData, prefix: string, value: unknown): void {
  if (value === undefined || value === null) return
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) appendFields(form, `${prefix}[${k}]`, v)
  } else {
    form.append(prefix, String(value))
  }
}

interface RenderingOpts {
  sourceDocument?: string
  image?: string
  width?: string
  height?: string
  tiles?: string
}

function addRenderingOptions(c: Command): Command {
  return c
    .option('--source-document <path>', 'Floor plan PDF (max 32 MB)')
    .option('--image <path>', 'PNG render of page 1 of the PDF')
    .option('--width <px>', 'Width of --image in pixels')
    .option('--height <px>', 'Height of --image in pixels')
    .option(
      '--tiles <json|@file>',
      'JSON array of overlapping PNG sections covering the image: [{"image":"path.png","x":0,"y":0,"w":1600,"h":1600}] (x/y/w/h in full-image px, each side <= 1600 px, <= 5 MB)'
    )
}

function hasRendering(o: RenderingOpts): boolean {
  return Boolean(o.sourceDocument || o.image || o.tiles)
}

function buildForm(fields: Record<string, unknown>, o: RenderingOpts): FormData {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) appendFields(form, k, v)
  if (o.sourceDocument) {
    const p = fileOrExit(o.sourceDocument)
    form.append('source_document', fs.createReadStream(p), { filename: path.basename(p) })
  }
  if (o.image) {
    const p = fileOrExit(o.image)
    form.append('image', fs.createReadStream(p), { filename: path.basename(p) })
  }
  if (o.width) form.append('width', o.width)
  if (o.height) form.append('height', o.height)
  if (o.tiles) {
    const parsed = o.tiles.startsWith('@') || o.tiles.trim().startsWith('[')
      ? JSON.parse(o.tiles.startsWith('@') ? fs.readFileSync(o.tiles.slice(1), 'utf8') : o.tiles)
      : null
    if (!Array.isArray(parsed)) {
      console.error(chalk.red('✗') + ' --tiles must be a JSON array (or @file containing one).')
      process.exit(1)
    }
    parsed.forEach((t: Record<string, unknown>, i: number) => {
      const p = fileOrExit(String(t.image))
      form.append(`tiles[${i}][image]`, fs.createReadStream(p), { filename: path.basename(p) })
      for (const k of ['x', 'y', 'w', 'h']) form.append(`tiles[${i}][${k}]`, String(t[k]))
    })
  }
  return form
}

function planFields(opts: Record<string, string | undefined>): Record<string, unknown> {
  let body: Record<string, unknown> = {}
  if (opts.name) body.name = opts.name
  if (opts.namesPublished) body.names_published = opts.namesPublished
  if (opts.assignmentField) body.assignment_custom_field_id = opts.assignmentField
  if (opts.statusField) body.status_custom_field_id = opts.statusField
  if (opts.data) body = deepMerge(body, parseDataFlag(opts.data))
  return body
}

export function registerFloorPlansCommands(program: Command): void {
  const cmd = program
    .command('floor-plans')
    .description('Manage floor plans and booth assignments (host; the API has no list endpoint, use the plan id)')

  cmd
    .command('show <id>')
    .description('Show a floor plan with its booths and assignments')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching floor plan...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/floor_plans/${id}`)
      )
      printObject(response.data, { json: g.json })
    })

  addRenderingOptions(
    cmd
      .command('create')
      .description('Create a floor plan from a PDF plus the client-rendered page image and tiles (multipart)')
      .requiredOption('--name <name>', 'Floor plan name')
      .option('--names-published', 'Show vendor names to other vendors')
      .option('--assignment-field <id>', 'Custom field ID that holds the booth assignment')
      .option('--status-field <id>', 'Custom field ID that holds the booth status')
      .option('--data <json>', DATA_HELP)
  ).action(async (opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const fields = planFields({ ...opts, namesPublished: opts.namesPublished ? 'true' : undefined })
    const form = buildForm(fields, opts)
    const client = createMultipartClient({ test: g.test })
    const response = await withSpinner('Creating floor plan...', () =>
      client.post(`/api/v1/e/${event}/p/${partnership}/floor_plans`, form, { headers: form.getHeaders() })
    )
    printObject(response.data, { json: g.json })
  })

  addRenderingOptions(
    cmd
      .command('update <id>')
      .description('Update a floor plan (pass --source-document/--image/--tiles to replace its rendering)')
      .option('--name <name>', 'New name')
      .option('--names-published <bool>', 'true or false: show vendor names to other vendors')
      .option('--assignment-field <id>', 'Custom field ID that holds the booth assignment')
      .option('--status-field <id>', 'Custom field ID that holds the booth status')
      .option('--data <json>', DATA_HELP)
  ).action(async (id, opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const fields = planFields(opts)
    const url = `/api/v1/e/${event}/p/${partnership}/floor_plans/${id}`
    let response
    if (hasRendering(opts)) {
      const form = buildForm(fields, opts)
      const client = createMultipartClient({ test: g.test })
      response = await withSpinner('Updating floor plan...', () =>
        client.patch(url, form, { headers: form.getHeaders() })
      )
    } else {
      const client = createClient({ test: g.test })
      response = await withSpinner('Updating floor plan...', () => client.patch(url, fields))
    }
    printObject(response.data, { json: g.json })
  })

  cmd
    .command('delete <id>')
    .description('Delete a floor plan')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete floor plan ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting floor plan...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/floor_plans/${id}`)
      )
      printSuccess(`Floor plan ${id} deleted.`)
    })

  cmd
    .command('detect <id>')
    .description('Re-run booth detection on a floor plan')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Detecting booths...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/floor_plans/${id}/detect`)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('assign <id>')
    .description('Assign booths on a floor plan to an organization')
    .requiredOption('--organization-partnership <id>', 'Organization partnership to assign')
    .option('--booth <id>', 'Booth ID (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--mode <mode>', 'assign (default), move, share or unassign')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {
        organization_partnership_id: opts.organizationPartnership,
        booth_ids: opts.booth,
      }
      if (opts.mode) body.mode = opts.mode
      const response = await withSpinner('Assigning booths...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/floor_plans/${id}/assignments`, body)
      )
      printObject(response.data, { json: g.json })
    })
}

export function registerBoothsCommands(program: Command): void {
  const cmd = program
    .command('booths')
    .description('Fix booths on a floor plan after detection (host)')

  cmd
    .command('create <floorPlanId>')
    .description('Draw a booth (coordinates on a 0-1000 image scale)')
    .requiredOption('--label <label>', 'Booth label')
    .requiredOption('--x1 <n>', 'Left')
    .requiredOption('--y1 <n>', 'Top')
    .requiredOption('--x2 <n>', 'Right')
    .requiredOption('--y2 <n>', 'Bottom')
    .action(async (floorPlanId, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body = { label: opts.label, x1: opts.x1, y1: opts.y1, x2: opts.x2, y2: opts.y2 }
      const response = await withSpinner('Creating booth...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/floor_plans/${floorPlanId}/booths`, body)
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('update <id>')
    .description('Rename a booth')
    .requiredOption('--label <label>', 'New label')
    .action(async (id, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Updating booth...', () =>
        client.patch(`/api/v1/e/${event}/p/${partnership}/booths/${id}`, { label: opts.label })
      )
      printObject(response.data, { json: g.json })
    })

  cmd
    .command('delete <id>')
    .description('Delete a booth')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete booth ${id}?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting booth...', () =>
        client.delete(`/api/v1/e/${event}/p/${partnership}/booths/${id}`)
      )
      printSuccess(`Booth ${id} deleted.`)
    })
}
