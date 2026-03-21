import { Command } from 'commander'
import { createClient } from '../api-client'
import { printArray } from '../output'
import { getGlobalOpts } from '../global-opts'

export function registerMyEventsCommands(program: Command): void {
  const cmd = program
    .command('my-events')
    .description('List events you belong to')

  cmd
    .command('list')
    .description('List all events the authenticated user belongs to')
    .action(async (_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const client = createClient({ test: g.test })
      const response = await client.get('/api/v1/events/my_events')
      printArray(response.data, ['id', 'name', 'permalink', 'archived', 'created_at'], { json: g.json })
    })
}
