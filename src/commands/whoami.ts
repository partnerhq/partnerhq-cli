import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import axios, { AxiosError } from 'axios'
import ora from 'ora'
import { getGlobalOpts } from '../global-opts'
import { getToken, getBaseUrl, resolveEnvironment } from '../config'
import { printBanner } from '../output'

interface Identity {
  id: number
  name: string
  email: string
  admin: boolean
}

async function fetchIdentity(baseUrl: string, token: string): Promise<Identity> {
  const res = await axios.get(`${baseUrl}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 10_000,
  })
  return {
    id: res.data.id,
    name: res.data.name,
    email: res.data.email,
    admin: res.data.admin,
  }
}

function classifyError(err: unknown): string {
  const axiosErr = err as AxiosError
  if (axiosErr?.response?.status === 401) {
    return 'token rejected (401) — run `phq auth login`'
  }
  if (axiosErr?.code === 'ECONNREFUSED' || axiosErr?.code === 'ENOTFOUND') {
    return 'could not connect to API'
  }
  return 'could not reach API'
}

export function registerWhoamiCommand(program: Command): void {
  program
    .command('whoami')
    .description('Show your current CLI context (identity, environment, token, event, partnership)')
    .action(async (_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)

      const env = resolveEnvironment(g.test)
      const token = getToken(env)
      const baseUrl = getBaseUrl(g.test)

      let identity: Identity | null = null
      let identityError: string | null = null

      if (token) {
        const spinner = g.json ? null : ora('Fetching identity...').start()
        try {
          identity = await fetchIdentity(baseUrl, token)
          spinner?.stop()
        } catch (err) {
          identityError = classifyError(err)
          spinner?.stop()
        }
      }

      if (g.json) {
        console.log(JSON.stringify({
          environment: env,
          base_url: baseUrl,
          authenticated: !!token,
          identity,
          identity_error: identityError,
          event: g.event ?? null,
          partnership: g.partnership ?? null,
        }, null, 2))
        return
      }

      const identityTable = new Table({ style: { head: ['cyan'] } })
      if (identity) {
        identityTable.push(
          [chalk.bold('Logged in as'), `${chalk.cyan(identity.name)} ${chalk.dim(`<${identity.email}>`)}`],
          [chalk.bold('User ID'), chalk.cyan(String(identity.id))],
          [chalk.bold('Admin'), identity.admin ? chalk.yellow('✓ yes') : chalk.dim('—')],
        )
      } else if (token && identityError) {
        identityTable.push(
          [chalk.bold('Logged in as'), chalk.dim(`(offline — ${identityError})`)],
        )
      } else {
        identityTable.push(
          [chalk.bold('Logged in as'), chalk.red('✗ Not logged in')],
        )
      }
      console.log(identityTable.toString())

      const contextTable = new Table({ style: { head: ['cyan'] } })
      contextTable.push(
        [chalk.bold('Environment'), `${chalk.cyan(env)} ${chalk.dim(`(${baseUrl})`)}`],
        [chalk.bold('Token'), token
          ? chalk.green('✓') + ' ' + chalk.dim(token.slice(0, 8) + '...' + token.slice(-4))
          : chalk.red('✗ none')
        ],
        [chalk.bold('Event'), g.event ? chalk.cyan(g.event) : chalk.dim('(not set)')],
        [chalk.bold('Partnership'), g.partnership ? chalk.cyan(g.partnership) : chalk.dim('(not set)')],
      )

      console.log(contextTable.toString())
    })
}
