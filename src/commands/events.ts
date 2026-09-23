import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import chalk from 'chalk'
import { Command } from 'commander'
import { createClient, createMultipartClient, withSpinner } from '../api-client'
import { printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts } from '../global-opts'
import { confirmOrExit } from '../prompt'
import { parseDataFlag, deepMerge } from '../data-flag'

const EVENT_DATA_HELP =
  'Extra event attributes as JSON or @file, merged over flags (e.g. page_builder_enabled, pdf_download_link_position above|below, email_domain_id, inherit_organization_email_domain)'

export function registerEventsCommands(program: Command): void {
  const events = program
    .command('events')
    .description('Manage PartnerHQ events (projects)')

  events
    .command('get <permalink>')
    .description('Get details for an event by its permalink')
    .action(async (permalink, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching event...', () =>
        client.get(`/api/v1/events/${permalink}`)
      )
      printObject(response.data, { json: g.json })
    })

  events
    .command('create')
    .description('Create a new event')
    .requiredOption('--name <name>', 'Name of the event')
    .option('--welcome-message <message>', 'Welcome message shown to partners')
    .option('--brand-color <hex>', 'Brand color hex (e.g. #FF0000)')
    .option('--data <json>', EVENT_DATA_HELP)
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      let body: Record<string, unknown> = { name: opts.name }
      if (opts.welcomeMessage) body.welcome_message = opts.welcomeMessage
      if (opts.brandColor) body.brand_color_hex = opts.brandColor
      if (opts.data) body = deepMerge(body, parseDataFlag(opts.data))

      const response = await withSpinner('Creating event...', () =>
        client.post('/api/v1/events', { event: body })
      )
      printObject(response.data, { json: g.json })
    })

  events
    .command('update <permalink>')
    .description('Update an existing event')
    .option('--name <name>', 'New name for the event')
    .option('--welcome-message <message>', 'New welcome message')
    .option('--brand-color <hex>', 'New brand color hex')
    .option('--data <json>', EVENT_DATA_HELP)
    .option('--logo <path>', 'Upload a logo image file for the event')
    .option('--remove-logo', 'Remove the event logo')
    .action(async (permalink, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (opts.logo && opts.removeLogo) {
        console.error(chalk.red('✗') + ' Use either --logo or --remove-logo, not both.')
        process.exit(1)
      }
      const logoPath = opts.logo ? path.resolve(opts.logo) : undefined
      if (logoPath && !fs.existsSync(logoPath)) {
        console.error(chalk.red('✗') + ` File not found: ${logoPath}`)
        process.exit(1)
      }
      const client = createClient({ test: g.test })
      let body: Record<string, unknown> = {}
      if (opts.name) body.name = opts.name
      if (opts.welcomeMessage) body.welcome_message = opts.welcomeMessage
      if (opts.brandColor) body.brand_color_hex = opts.brandColor
      if (opts.removeLogo) body.remove_logo = true
      if (opts.data) body = deepMerge(body, parseDataFlag(opts.data))

      let response
      if (!logoPath || Object.keys(body).length > 0) {
        response = await withSpinner('Updating event...', () =>
          client.patch(`/api/v1/events/${permalink}`, { event: body })
        )
      }
      if (logoPath) {
        const form = new FormData()
        form.append('event[logo]', fs.createReadStream(logoPath), { filename: path.basename(logoPath) })
        const multipart = createMultipartClient({ test: g.test })
        response = await withSpinner('Uploading logo...', () =>
          multipart.patch(`/api/v1/events/${permalink}`, form, { headers: form.getHeaders() })
        )
      }
      printObject(response!.data, { json: g.json })
    })

  events
    .command('delete <permalink>')
    .description('Delete an event')
    .action(async (permalink, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Delete event '${permalink}'?`)
      const client = createClient({ test: g.test })
      await withSpinner('Deleting event...', () =>
        client.delete(`/api/v1/events/${permalink}`)
      )
      printSuccess(`Event '${permalink}' deleted.`)
    })
  events
    .command('archive <permalink>')
    .description('Archive a project (cannot be undone via the API)')
    .action(async (permalink, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Archive project ${permalink}?`)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Archiving project...', () =>
        client.post(`/api/v1/events/${permalink}/archive`)
      )
      printObject(response.data, { json: g.json })
    })

}
