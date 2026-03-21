import { Command } from 'commander'
import { createClient } from '../api-client'
import { printObject, printSuccess } from '../output'
import { getGlobalOpts } from '../global-opts'

export function registerEventsCommands(program: Command): void {
  const events = program
    .command('events')
    .description('Manage PartnerHQ events (projects)')

  events
    .command('get <permalink>')
    .description('Get details for an event by its permalink')
    .action(async (permalink, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/events/${permalink}`)
      printObject(response.data, { json: g.json })
    })

  events
    .command('create')
    .description('Create a new event')
    .requiredOption('--name <name>', 'Name of the event')
    .option('--welcome-message <message>', 'Welcome message shown to partners')
    .option('--brand-color <hex>', 'Brand color hex (e.g. #FF0000)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const client = createClient({ test: g.test })
      const body: Record<string, string> = { name: opts.name }
      if (opts.welcomeMessage) body.welcome_message = opts.welcomeMessage
      if (opts.brandColor) body.brand_color_hex = opts.brandColor

      const response = await client.post('/api/v1/events', { event: body })
      printObject(response.data, { json: g.json })
    })

  events
    .command('update <permalink>')
    .description('Update an existing event')
    .option('--name <name>', 'New name for the event')
    .option('--welcome-message <message>', 'New welcome message')
    .option('--brand-color <hex>', 'New brand color hex')
    .action(async (permalink, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const client = createClient({ test: g.test })
      const body: Record<string, string> = {}
      if (opts.name) body.name = opts.name
      if (opts.welcomeMessage) body.welcome_message = opts.welcomeMessage
      if (opts.brandColor) body.brand_color_hex = opts.brandColor

      const response = await client.patch(`/api/v1/events/${permalink}`, { event: body })
      printObject(response.data, { json: g.json })
    })

  events
    .command('delete <permalink>')
    .description('Delete an event')
    .action(async (permalink, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const client = createClient({ test: g.test })
      await client.delete(`/api/v1/events/${permalink}`)
      printSuccess(`Event '${permalink}' deleted.`)
    })
}
