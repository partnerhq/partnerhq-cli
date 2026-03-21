import { Command } from 'commander'
import { createClient } from '../../api-client'
import { printObject } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

export function registerPartnerProfileCommands(cmd: Command): void {
  const profile = cmd
    .command('profile')
    .description("Manage your own partner profile within an event")

  profile
    .command('get')
    .description("Get your own partner profile")
    .action(async (_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await client.get(`/api/v1/e/${event}/p/${partnership}/partner/profile`)
      printObject(response.data, { json: g.json })
    })

  profile
    .command('update')
    .description("Update your own partner profile")
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
    .option('--notify-for-new-chats <bool>', 'Notify for new chats (true/false)')
    .option('--notify-for-completed-tasks <bool>', 'Notify for completed tasks (true/false)')
    .option('--notify-for-task-reminders <bool>', 'Notify for task reminders (true/false)')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const body: Record<string, unknown> = {}
      if (opts.firstName) body.first_name = opts.firstName
      if (opts.lastName) body.last_name = opts.lastName
      if (opts.notifyForNewChats !== undefined) body.notify_for_new_chats = opts.notifyForNewChats === 'true'
      if (opts.notifyForCompletedTasks !== undefined) body.notify_for_completed_tasks = opts.notifyForCompletedTasks === 'true'
      if (opts.notifyForTaskReminders !== undefined) body.notify_for_task_reminders = opts.notifyForTaskReminders === 'true'
      const response = await client.patch(`/api/v1/e/${event}/p/${partnership}/partner/profile`, { partnership: body })
      printObject(response.data, { json: g.json })
    })
}
