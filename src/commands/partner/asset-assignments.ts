import { Command } from 'commander'
import { createClient, PaginatedResponse, withSpinner } from '../../api-client'
import { printList, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

const LIST_COLS = ['id', 'asset', 'organization', 'chat_channel', 'public_permalink']

export function registerPartnerAssetAssignmentsCommands(cmd: Command): void {
  const assets = cmd
    .command('asset-assignments')
    .description('Assets assigned to your organizations (use the id with --asset-assignment)')

  assets
    .command('list')
    .description('List asset assignments that have enabled task completions')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching asset assignments...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/partner/asset_assignments`, {
          params: { page: opts.page, per_page: opts.perPage },
        })
      )
      const data = response.data as PaginatedResponse<Record<string, unknown>>
      if (g.json) {
        printList(data, LIST_COLS, { json: true })
        return
      }
      const name = (v: unknown) => (v as { name?: string } | null)?.name
      printList(
        {
          ...data,
          collection: data.collection.map((row) => ({
            ...row,
            asset: name(row.asset),
            organization: name(row.organization_partnership),
            chat_channel: (row.chat_channel as { identifier?: string } | null)?.identifier,
          })),
        },
        LIST_COLS,
        { json: false }
      )
    })
}
