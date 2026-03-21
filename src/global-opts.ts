import { Command } from 'commander'
import chalk from 'chalk'
import { getDefaults } from './config'

export interface GlobalOpts {
  test: boolean
  json: boolean
  yes: boolean
  event?: string
  partnership?: string
}

/**
 * Resolve global options with the priority chain:
 *   CLI flag > environment variable > saved config defaults
 */
export function getGlobalOpts(cmd: Command): GlobalOpts {
  const opts = cmd.optsWithGlobals()
  const defaults = getDefaults()

  const test =
    opts.test === true ||
    process.env.PHQ_TEST === '1' ||
    process.env.PHQ_TEST === 'true' ||
    defaults.test === true

  return {
    test,
    json: opts.json === true,
    yes: opts.yes === true,
    event: opts.event ?? process.env.PHQ_EVENT ?? defaults.event,
    partnership: opts.partnership ?? process.env.PHQ_PARTNERSHIP ?? defaults.partnership,
  }
}

export function requireEventAndPartnership(g: GlobalOpts): { event: string; partnership: string } {
  if (!g.event) {
    console.error(
      chalk.red('✗') +
      ` No event specified. Pass ${chalk.bold('--event <permalink>')} or run ${chalk.cyan("'phq config set event <permalink>'")} to save a default.`
    )
    process.exit(1)
  }
  if (!g.partnership) {
    console.error(
      chalk.red('✗') +
      ` No partnership specified. Pass ${chalk.bold('--partnership <id>')} or run ${chalk.cyan("'phq config set partnership <id>'")} to save a default.`
    )
    process.exit(1)
  }
  return { event: g.event, partnership: g.partnership }
}
