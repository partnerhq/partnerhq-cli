import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import { getGlobalOpts } from '../global-opts'
import { getToken, getBaseUrl, resolveEnvironment } from '../config'
import { printBanner } from '../output'

export function registerWhoamiCommand(program: Command): void {
  program
    .command('whoami')
    .description('Show your current CLI context (environment, token, event, partnership)')
    .action((_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)

      const env = resolveEnvironment(g.test)
      const token = getToken(env)
      const baseUrl = getBaseUrl(g.test)

      if (g.json) {
        console.log(JSON.stringify({
          environment: env,
          base_url: baseUrl,
          authenticated: !!token,
          event: g.event ?? null,
          partnership: g.partnership ?? null,
        }, null, 2))
        return
      }

      const table = new Table({ style: { head: ['cyan'] } })

      table.push(
        [chalk.bold('Environment'), `${chalk.cyan(env)} ${chalk.dim(`(${baseUrl})`)}`],
        [chalk.bold('Authenticated'), token
          ? chalk.green('✓') + ' ' + chalk.dim(token.slice(0, 8) + '...' + token.slice(-4))
          : chalk.red('✗ Not logged in')
        ],
        [chalk.bold('Event'), g.event ? chalk.cyan(g.event) : chalk.dim('(not set)')],
        [chalk.bold('Partnership'), g.partnership ? chalk.cyan(g.partnership) : chalk.dim('(not set)')],
      )

      console.log(table.toString())
    })
}
