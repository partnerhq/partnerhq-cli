import { Command } from 'commander'
import { createClient, withSpinner } from '../../api-client'
import { printObject, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

export function registerPartnerInvitationsCommands(cmd: Command): void {
  const invitations = cmd
    .command('invitations')
    .description('Invite other organizations as teammates on your organization')

  invitations
    .command('create <organization-partnership-id>')
    .description('Invite another organization to join yours as a teammate')
    .requiredOption('--email <email>', 'Email address of the person to invite')
    .action(async (organizationPartnershipId, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Sending invitation...', () =>
        client.post(
          `/api/v1/e/${event}/p/${partnership}/partner/organization_partnerships/${organizationPartnershipId}/org_to_org_invitations`,
          { invitation: { email: opts.email } }
        )
      )
      printObject(response.data, { json: g.json })
    })
}
