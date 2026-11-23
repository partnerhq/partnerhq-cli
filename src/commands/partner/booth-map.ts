import { Command } from 'commander'
import { createClient, withSpinner } from '../../api-client'
import { printObject, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

export function registerPartnerBoothMapCommands(cmd: Command): void {
  cmd
    .command('booth-map')
    .description('Show the floor plan from a Resource, with your organization\'s booths marked "mine"')
    .requiredOption('--custom-field <id>', "ID of the Resource's Floor plan custom field")
    .option('--organization-partnership <id>', 'Limit to one of your organizations')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const params: Record<string, unknown> = { custom_field_id: opts.customField }
      if (opts.organizationPartnership) params.organization_partnership_id = opts.organizationPartnership
      const response = await withSpinner('Fetching booth map...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/booth_map`, { params })
      )
      if (response.status === 204 || !response.data) {
        console.log('No booth map available (booth maps off, plan not ready, or field not on a published Resource).')
        return
      }
      printObject(response.data, { json: g.json })
    })
}
