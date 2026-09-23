import { Command } from 'commander'
import chalk from 'chalk'
import axios, { AxiosError } from 'axios'
import { getGlobalOpts } from '../global-opts'
import { getToken, getBaseUrl, resolveEnvironment, getMasquerade, setMasquerade } from '../config'
import { MASQUERADE_HEADER } from '../api-client'
import { printBanner, printError, printSuccess, printMasqueradeBanner } from '../output'

export function registerMasqueradeCommands(program: Command): void {
  const masquerade = program
    .command('masquerade')
    .description('PHQ admins: act as another user until `phq masquerade stop`')

  masquerade
    .command('start <user>')
    .description('Act as another user (email or user ID). Every command then runs as them.')
    .action(async (user: string, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const env = resolveEnvironment(g.test)
      const token = getToken(env)
      if (!token) {
        printError(`Not logged in (${env}). Run 'phq auth login${g.test ? ' --test' : ''}' first.`)
        process.exit(1)
      }

      // Handshake: only store the masquerade once the server confirms it.
      let data: Record<string, any>
      try {
        const res = await axios.get(`${getBaseUrl(g.test)}/api/v1/me`, {
          headers: { Authorization: `Bearer ${token}`, [MASQUERADE_HEADER]: user, Accept: 'application/json' },
          timeout: 10_000,
        })
        data = res.data
      } catch (err) {
        const res = (err as AxiosError<{ error?: string }>).response
        printError(res ? `${res.data?.error ?? 'Request failed'} (${res.status})` : 'Could not reach the API.')
        process.exit(1)
      }

      const admin = data.masquerading_user
      if (!admin) {
        printError('The server did not confirm the masquerade (it may not support API masquerading yet). Nothing saved.')
        process.exit(1)
      }

      setMasquerade(env, { id: data.id, email: data.email, name: data.name, admin_email: admin.email, since: new Date().toISOString() })

      if (g.json) {
        console.log(JSON.stringify({ environment: env, masquerading_as: { id: data.id, email: data.email, name: data.name }, real_user: admin }, null, 2))
      } else {
        printSuccess(`Now acting as ${chalk.bold(data.name)} <${data.email}> in ${chalk.cyan(env)}.`)
      }
      printMasqueradeBanner(env)
    })

  masquerade
    .command('stop')
    .description('Stop masquerading and act as yourself again')
    .action((_opts, cmd) => {
      const g = getGlobalOpts(cmd)
      const env = resolveEnvironment(g.test)
      const current = getMasquerade(env)
      if (!current) {
        printSuccess(`Not masquerading (${env}).`)
        return
      }
      setMasquerade(env, undefined)
      printSuccess(`Stopped acting as ${current.email}. Back to ${chalk.bold(current.admin_email)} (${env}).`)
    })
}
