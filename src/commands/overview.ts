import { Command } from 'commander'
import { createClient, withSpinner } from '../api-client'
import { printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const collect = (v: string, a: string[]) => [...a, v]

export function registerOverviewCommands(program: Command): void {
  const cmd = program
    .command('overview')
    .description('Host overview: partner status, reminders and disregarded tasks')

  cmd
    .command('partner-status')
    .description('Partner status for a time window, with remind/disregard permissions')
    .option('--range <range>', 'today, 7d (default), 14d, 30d or custom')
    .option('--start <date>', 'Start date for --range custom (YYYY-MM-DD)')
    .option('--end <date>', 'End date for --range custom (YYYY-MM-DD)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const params: Record<string, unknown> = {}
      if (opts.range) params.range = opts.range
      if (opts.start) params.start = opts.start
      if (opts.end) params.end = opts.end
      const response = await withSpinner('Fetching partner status...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/host/partner_status`, { params })
      )
      console.log(JSON.stringify(response.data, null, 2))
    })

  const actions: [string, string, 'post' | 'delete', string, string][] = [
    ['remind', 'Send reminders for these task completions', 'post', 'task_reminders', 'Sending reminders...'],
    ['disregard', 'Disregard (hide from overdue/reminders) these task completions', 'post', 'task_disregards', 'Disregarding...'],
    ['restore', 'Restore previously disregarded task completions', 'delete', 'task_disregards', 'Restoring...'],
  ]
  for (const [name, description, verb, path, spinner] of actions) {
    const sub = cmd
      .command(name)
      .description(description)
      .requiredOption('--task-completion-id <id>', 'Task completion id (repeatable)', collect, [] as string[])
    if (name === 'remind') sub.option('--force', 'Send even if recently reminded')
    sub.action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      if (name === 'remind' && !g.yes) await confirmOrExit(`Send reminders for ${opts.taskCompletionId.length} task completion(s)?`)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const url = `/api/v1/e/${event}/p/${partnership}/host/${path}`
      const body: Record<string, unknown> = { task_completion_ids: opts.taskCompletionId }
      if (opts.force) body.force = true
      const response = await withSpinner(spinner, () =>
        verb === 'post' ? client.post(url, body) : client.delete(url, { data: body })
      )
      printObject(response.data as Record<string, unknown>, { json: g.json })
    })
  }
}
