import { Command } from 'commander'
import chalk from 'chalk'
import { createClient, withSpinner } from '../../api-client'
import { printObject, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'
import { htmlToText } from '../../html'

export function registerPartnerEventCommands(cmd: Command): void {
  const eventCmd = cmd
    .command('event')
    .description('The project you belong to, as a partner sees it')

  eventCmd
    .command('get')
    .description('Get project details (name, time zone, welcome message, feature flags)')
    .action(async (_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching project...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/event`)
      )
      if (g.json) {
        printObject(response.data, { json: true })
        return
      }
      const data = { ...(response.data as Record<string, unknown>) }
      const welcome = data.welcome_message as string | null | undefined
      delete data.welcome_message
      printObject(data, { json: false })
      if (welcome) {
        console.log('\n' + chalk.bold.cyan('Welcome message'))
        console.log(htmlToText(welcome))
      }
    })
}
