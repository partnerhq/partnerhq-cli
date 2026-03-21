import { Command } from 'commander'
import { createUnauthenticatedClient } from '../api-client'
import { setToken, clearToken, resolveEnvironment, getToken } from '../config'
import { printSuccess, printError } from '../output'

function isTestMode(cmd: Command): boolean {
  const opts = cmd.optsWithGlobals()
  return opts.test === true || process.env.PHQ_TEST === '1' || process.env.PHQ_TEST === 'true'
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Authenticate with the PartnerHQ API')

  auth
    .command('login')
    .description('Log in and store an OAuth token')
    .requiredOption('--email <email>', 'Your PartnerHQ account email')
    .requiredOption('--password <password>', 'Your PartnerHQ account password')
    .action(async (opts, cmd) => {
      const test = isTestMode(cmd)
      const env = resolveEnvironment(test)
      const client = createUnauthenticatedClient({ test })

      try {
        const response = await client.post('/oauth/token', {
          grant_type: 'password',
          email: opts.email,
          password: opts.password,
        })

        const token = response.data?.access_token
        if (!token) {
          printError('Login failed: no access token returned.')
          process.exit(1)
        }

        setToken(env, token)
        printSuccess(
          `Logged in as ${opts.email} (${env}). Token saved to ~/.partnerhq/config.json`
        )
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error_description?: string } } }
        const msg = axiosErr?.response?.data?.error_description ?? 'Login failed.'
        printError(msg)
        process.exit(1)
      }
    })

  auth
    .command('logout')
    .description('Revoke the stored OAuth token')
    .action(async (_opts, cmd) => {
      const test = isTestMode(cmd)
      const env = resolveEnvironment(test)
      const token = getToken(env)

      if (!token) {
        printError(`Not logged in (${env}).`)
        process.exit(1)
      }

      const client = createUnauthenticatedClient({ test })

      try {
        await client.post('/oauth/revoke', { token })
      } catch {
        // Proceed with local cleanup even if the revoke request fails
      }

      clearToken(env)
      printSuccess(`Logged out (${env}). Token removed from ~/.partnerhq/config.json`)
    })

  auth
    .command('status')
    .description('Show the current authentication status')
    .action((_opts, cmd) => {
      const test = isTestMode(cmd)
      const env = resolveEnvironment(test)
      const token = getToken(env)

      if (token) {
        const masked = token.slice(0, 8) + '...' + token.slice(-4)
        printSuccess(`Authenticated (${env}). Token: ${masked}`)
      } else {
        printError(`Not authenticated (${env}).`)
      }
    })
}
