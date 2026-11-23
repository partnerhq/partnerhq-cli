import { Command } from 'commander'
import { createClient, withSpinner } from '../api-client'
import { printArray, printSuccess, printBanner } from '../output'
import { getGlobalOpts } from '../global-opts'
import { confirmOrExit } from '../prompt'

export function registerBlocksCommands(program: Command): void {
  const cmd = program
    .command('blocks')
    .description('Manage the users you have blocked')

  cmd
    .command('list')
    .description('List the users you have blocked')
    .action(async (_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching blocks...', () => client.get('/api/v1/blocks'))
      printArray(response.data as Record<string, unknown>[], ['id', 'name', 'blocked_at'], { json: g.json })
    })

  cmd
    .command('remove <id>')
    .description('Unblock a user (id from `blocks list`)')
    .action(async (id, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (!g.yes) await confirmOrExit(`Unblock block ${id}?`)
      const client = createClient({ test: g.test })
      await withSpinner('Removing block...', () => client.delete(`/api/v1/blocks/${id}`))
      printSuccess(`Block ${id} removed.`)
    })
}
