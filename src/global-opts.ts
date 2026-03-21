import { Command } from 'commander'

export interface GlobalOpts {
  test: boolean
  json: boolean
  event?: string
  partnership?: string
}

export function getGlobalOpts(cmd: Command): GlobalOpts {
  const opts = cmd.optsWithGlobals()
  const test =
    opts.test === true ||
    process.env.PHQ_TEST === '1' ||
    process.env.PHQ_TEST === 'true'

  return {
    test,
    json: opts.json === true,
    event: opts.event ?? process.env.PHQ_EVENT,
    partnership: opts.partnership ?? process.env.PHQ_PARTNERSHIP,
  }
}

export function requireEventAndPartnership(g: GlobalOpts): { event: string; partnership: string } {
  if (!g.event) {
    console.error(
      "Error: --event <permalink> is required (or set PHQ_EVENT)."
    )
    process.exit(1)
  }
  if (!g.partnership) {
    console.error(
      "Error: --partnership <id> is required (or set PHQ_PARTNERSHIP)."
    )
    process.exit(1)
  }
  return { event: g.event, partnership: g.partnership }
}
