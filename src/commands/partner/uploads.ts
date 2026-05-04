import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import chalk from 'chalk'
import { Command } from 'commander'
import {
  createMultipartClient,
  createClient,
  getRedirectLocation,
  downloadToFile,
  withSpinner,
} from '../../api-client'
import { printObject, printSuccess, printBanner } from '../../output'
import { getGlobalOpts, requireEventAndPartnership } from '../../global-opts'

interface UploadKind {
  /** sub-command name on the CLI */
  cliName: string
  /** human-friendly label for spinners and help */
  label: string
  /** API path segment (after `/partner/`) */
  apiSegment: string
  /** wrapper key used for both the params namespace and the multipart prefix */
  wrapperKey: string
}

const KINDS: UploadKind[] = [
  {
    cliName: 'custom-field-file',
    label: 'custom-field file',
    apiSegment: 'custom_field_file_uploads',
    wrapperKey: 'custom_field_file_upload',
  },
  { cliName: 'image', label: 'image', apiSegment: 'images', wrapperKey: 'image' },
  { cliName: 'video', label: 'video', apiSegment: 'videos', wrapperKey: 'video' },
  { cliName: 'file', label: 'file', apiSegment: 'uploads', wrapperKey: 'upload' },
]

export function registerPartnerUploadsCommands(cmd: Command): void {
  const uploads = cmd
    .command('uploads')
    .description('Upload and download files (custom-field files, images, videos, generic files)')

  for (const kind of KINDS) {
    const sub = uploads
      .command(kind.cliName)
      .description(`Upload and download ${kind.label}s`)

    sub
      .command('create')
      .description(`Upload a ${kind.label}`)
      .requiredOption('--file <path>', 'Local path to the file to upload')
      .action(async (opts, cmd) => {
        const g = getGlobalOpts(cmd)
        printBanner(g.test, g.json)
        const { event, partnership } = requireEventAndPartnership(g)

        const filePath = path.resolve(opts.file)
        if (!fs.existsSync(filePath)) {
          console.error(chalk.red('✗') + ` File not found: ${filePath}`)
          process.exit(1)
        }

        const form = new FormData()
        form.append(`${kind.wrapperKey}[file]`, fs.createReadStream(filePath), {
          filename: path.basename(filePath),
        })

        const client = createMultipartClient({ test: g.test })
        const response = await withSpinner(`Uploading ${kind.label}...`, () =>
          client.post(
            `/api/v1/e/${event}/p/${partnership}/partner/${kind.apiSegment}`,
            form,
            { headers: form.getHeaders() }
          )
        )
        printObject(response.data, { json: g.json })
      })

    sub
      .command('get <id>')
      .description(
        `Get a ${kind.label} download URL (or save the file with --output)`
      )
      .option('--output <path>', 'Local path to save the downloaded file')
      .action(async (id, opts, cmd) => {
        const g = getGlobalOpts(cmd)
        printBanner(g.test, g.json)
        const { event, partnership } = requireEventAndPartnership(g)

        const client = createClient({ test: g.test })
        const apiPath = `/api/v1/e/${event}/p/${partnership}/partner/${kind.apiSegment}/${id}`
        const url = await getRedirectLocation(client, apiPath)

        if (!opts.output) {
          console.log(url)
          return
        }

        const outputPath = path.resolve(opts.output)
        await downloadToFile(url, outputPath)
        printSuccess(`Wrote ${outputPath}`)
      })
  }
}
