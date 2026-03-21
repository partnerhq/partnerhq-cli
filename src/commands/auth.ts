import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import ora from 'ora'
import { createUnauthenticatedClient } from '../api-client'
import { setToken, clearToken, resolveEnvironment, getToken, getBaseUrl, getDefaults } from '../config'
import { printSuccess, printError, printBanner } from '../output'
import { promptInput, promptPassword } from '../prompt'

function isTestMode(cmd: Command): boolean {
  const opts = cmd.optsWithGlobals()
  const defaults = getDefaults()
  return (
    opts.test === true ||
    process.env.PHQ_TEST === '1' ||
    process.env.PHQ_TEST === 'true' ||
    defaults.test === true
  )
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Authenticate with the PartnerHQ API')

  auth
    .command('login')
    .description('Log in and store an OAuth token')
    .option('--email <email>', 'Your PartnerHQ account email')
    .option('--password <password>', 'Your PartnerHQ account password')
    .action(async (opts, cmd) => {
      const test = isTestMode(cmd)
      const env = resolveEnvironment(test)
      printBanner(test, false)

      const email = opts.email ?? await promptInput('Email:')
      const password = opts.password ?? await promptPassword('Password:')

      if (!email || !password) {
        printError('Email and password are required.')
        process.exit(1)
      }

      const client = createUnauthenticatedClient({ test })
      const spinner = ora('Logging in...').start()

      try {
        const response = await client.post('/oauth/token', {
          grant_type: 'password',
          email,
          password,
        })

        const token = response.data?.access_token
        if (!token) {
          spinner.fail('Login failed: no access token returned.')
          process.exit(1)
        }

        setToken(env, token)
        spinner.succeed(
          `Logged in as ${chalk.bold(email)} (${chalk.cyan(env)})`
        )
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error_description?: string } } }
        const msg = axiosErr?.response?.data?.error_description ?? 'Login failed. Check your credentials.'
        spinner.fail(msg)
        process.exit(1)
      }
    })

  auth
    .command('logout')
    .description('Revoke the stored OAuth token')
    .action(async (_opts, cmd) => {
      const test = isTestMode(cmd)
      const env = resolveEnvironment(test)
      printBanner(test, false)
      const token = getToken(env)

      if (!token) {
        printError(`Not logged in (${env}).`)
        process.exit(1)
      }

      const client = createUnauthenticatedClient({ test })
      const spinner = ora('Logging out...').start()

      try {
        await client.post('/oauth/revoke', { token })
      } catch {
        // Proceed with local cleanup even if the revoke request fails
      }

      clearToken(env)
      spinner.succeed(`Logged out (${chalk.cyan(env)}).`)
    })

  auth
    .command('status')
    .description('Show authentication status for all environments')
    .action(() => {
      const table = new Table({
        style: { head: ['cyan'] },
      })

      const environments = ['production', 'test'] as const
      for (const env of environments) {
        const token = getToken(env)
        const url = getBaseUrl(env === 'test')
        if (token) {
          const masked = token.slice(0, 8) + '...' + token.slice(-4)
          table.push([
            chalk.bold(env),
            chalk.green('✓ Authenticated'),
            chalk.dim(url),
            chalk.dim(masked),
          ])
        } else {
          table.push([
            chalk.bold(env),
            chalk.red('✗ Not logged in'),
            chalk.dim(url),
            chalk.dim('—'),
          ])
        }
      }

      console.log(table.toString())

      const defaults = getDefaults()
      const activeEnv = defaults.test === true ? 'test' : 'production'
      console.log(`\n  Active: ${chalk.bold.cyan(activeEnv)}`)
    })
}
