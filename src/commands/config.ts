import { Command } from 'commander'
import chalk from 'chalk'
import Table from 'cli-table3'
import { getDefaults, getDefault, setDefault, clearDefaults, removeDefault } from '../config'
import { printSuccess, printError } from '../output'

const VALID_KEYS = ['event', 'partnership', 'test']

export function registerConfigCommands(program: Command): void {
  const cmd = program
    .command('config')
    .description('Manage persistent CLI defaults (event, partnership, test mode)')

  cmd
    .command('set <key> <value>')
    .description(`Set a default value. Keys: ${VALID_KEYS.join(', ')}`)
    .action((key, value) => {
      if (!VALID_KEYS.includes(key)) {
        printError(`Unknown key '${key}'. Valid keys: ${VALID_KEYS.join(', ')}`)
        process.exit(1)
      }
      try {
        setDefault(key, value)
        printSuccess(`Set ${chalk.bold(key)} = ${chalk.cyan(value)}`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        printError(msg)
        process.exit(1)
      }
    })

  cmd
    .command('get <key>')
    .description('Get the current value of a default')
    .action((key) => {
      if (!VALID_KEYS.includes(key)) {
        printError(`Unknown key '${key}'. Valid keys: ${VALID_KEYS.join(', ')}`)
        process.exit(1)
      }
      const val = getDefault(key as 'event' | 'partnership' | 'test')
      if (val === undefined) {
        console.log(chalk.dim('(not set)'))
      } else {
        console.log(String(val))
      }
    })

  cmd
    .command('list')
    .description('Show all saved defaults')
    .action(() => {
      const defaults = getDefaults()
      const table = new Table({ style: { head: ['cyan'] } })

      for (const key of VALID_KEYS) {
        const val = defaults[key as keyof typeof defaults]
        const display = val === undefined
          ? chalk.dim('(not set)')
          : String(val)
        table.push([chalk.bold(key), display])
      }

      console.log(table.toString())
    })

  cmd
    .command('clear')
    .description('Remove all saved defaults (keeps authentication tokens)')
    .action(() => {
      clearDefaults()
      printSuccess('All saved defaults cleared.')
    })

  cmd
    .command('unset <key>')
    .description('Remove a single default')
    .action((key) => {
      if (!VALID_KEYS.includes(key)) {
        printError(`Unknown key '${key}'. Valid keys: ${VALID_KEYS.join(', ')}`)
        process.exit(1)
      }
      removeDefault(key)
      printSuccess(`Unset ${chalk.bold(key)}.`)
    })
}
