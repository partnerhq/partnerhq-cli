import path from 'path'
import { Command } from 'commander'
import { createClient, getRedirectLocation, downloadToFile, withSpinner } from '../api-client'
import { printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'

function addDownload(cmd: Command, segment: string, label: string): void {
  cmd
    .command('download <token>')
    .description(`Get the ${label} download URL (or save the file with --output)`)
    .option('--output <path>', 'Local path to save the file')
    .action(async (token, opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const url = await getRedirectLocation(
        client,
        `/api/v1/e/${event}/p/${partnership}/${segment}/${token}/download`
      )
      if (!opts.output) {
        console.log(url)
        return
      }
      const outputPath = path.resolve(opts.output)
      await downloadToFile(url, outputPath)
      printSuccess(`Wrote ${outputPath}`)
    })
}

function addGet(cmd: Command, segment: string): void {
  cmd
    .command('get <token>')
    .description('Get export status (processing or ready)')
    .action(async (token, _opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Fetching export...', () =>
        client.get(`/api/v1/e/${event}/p/${partnership}/${segment}/${token}`)
      )
      printObject(response.data, { json: g.json })
    })
}

export function registerCustomExportsCommands(program: Command): void {
  const cmd = program
    .command('custom-exports')
    .description('Build CSV exports of organizations with chosen custom-field columns')

  cmd
    .command('create')
    .description('Schedule a custom export (generated in the background, emailed to you)')
    .option('--custom-field <id>', 'Custom field column to include (repeatable)', (v, a: string[]) => [...a, v], [] as string[])
    .option('--include-users', 'One row per connected individual instead of per organization')
    .option('--memo <text>', 'A note to yourself, included in the email')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      // custom_field_ids always present so params.require(:custom_export) passes
      const body: Record<string, unknown> = { custom_field_ids: opts.customField }
      if (opts.includeUsers) body.include_users = true
      if (opts.memo) body.memo = opts.memo
      const response = await withSpinner('Scheduling export...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/custom_exports`, { custom_export: body })
      )
      printObject(response.data, { json: g.json })
    })

  addGet(cmd, 'custom_exports')
  addDownload(cmd, 'custom_exports', 'CSV')
}

export function registerTaskZipExportsCommands(program: Command): void {
  const cmd = program
    .command('task-zip-exports')
    .description('Bundle all submitted files for a task/org/completion into a ZIP')

  cmd
    .command('create')
    .description('Schedule a ZIP export (built in the background, emailed to you)')
    .requiredOption('--exportable-type <type>', 'Task, OrganizationPartnership, or TaskCompletion')
    .requiredOption('--exportable-id <id>', 'ID of the record whose files to bundle')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const { event, partnership } = requireEventAndPartnership(g)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Scheduling ZIP export...', () =>
        client.post(`/api/v1/e/${event}/p/${partnership}/task_zip_exports`, {
          task_zip_export: {
            exportable_type: opts.exportableType,
            exportable_id: opts.exportableId,
          },
        })
      )
      printObject(response.data, { json: g.json })
    })

  addGet(cmd, 'task_zip_exports')
  addDownload(cmd, 'task_zip_exports', 'ZIP')
}
