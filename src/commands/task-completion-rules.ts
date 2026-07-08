import { Command } from 'commander'
import { createClient, PaginatedResponse, withSpinner } from '../api-client'
import { printList, printObject, printSuccess, printBanner } from '../output'
import { getGlobalOpts, requireEventAndPartnership } from '../global-opts'
import { confirmOrExit } from '../prompt'

const LIST_COLS = ['id', 'custom_field_id', 'operator', 'custom_field_value', 'tag_id', 'enabled']

function basePath(event: string, partnership: string, opts: { task?: string; internalTask?: string }): string {
  const root = `/api/v1/e/${event}/p/${partnership}`
  if (opts.internalTask) return `${root}/internal_tasks/${opts.internalTask}/task_completion_rules`
  if (opts.task) return `${root}/tasks/${opts.task}/task_completion_rules`
  console.error('Pass --task <id> or --internal-task <id>')
  process.exit(1)
}

function parentOpts(cmd: Command): Command {
  return cmd
    .option('--task <id>', 'Parent task ID')
    .option('--internal-task <id>', 'Parent internal task ID')
}

export function registerTaskCompletionRulesCommands(program: Command): void {
  const cmd = program
    .command('task-completion-rules')
    .description('Auto-tagging rules on tasks (tag an org when a field matches)')

  parentOpts(
    cmd
      .command('list')
      .description('List rules on a task')
      .option('--page <n>', 'Page number', '1')
      .option('--per-page <n>', 'Results per page (max 250)', '30')
  ).action(async (opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const client = createClient({ test: g.test })
    const response = await withSpinner('Fetching rules...', () =>
      client.get(basePath(event, partnership, opts), { params: { page: opts.page, per_page: opts.perPage } })
    )
    printList(response.data as PaginatedResponse<Record<string, unknown>>, LIST_COLS, { json: g.json })
  })

  parentOpts(
    cmd
      .command('create')
      .description('Create a rule')
      .requiredOption('--custom-field <id>', 'Custom field whose value is evaluated')
      .requiredOption('--operator <op>', 'Comparison operator (e.g. equals)')
      .requiredOption('--value <value>', 'Value to compare against')
      .requiredOption('--tag <id>', 'Tag applied when the rule matches')
  ).action(async (opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const client = createClient({ test: g.test })
    const response = await withSpinner('Creating rule...', () =>
      client.post(basePath(event, partnership, opts), {
        task_completion_rule: {
          custom_field_id: opts.customField,
          operator: opts.operator,
          custom_field_value: opts.value,
          tag_id: opts.tag,
        },
      })
    )
    printObject(response.data, { json: g.json })
  })

  parentOpts(
    cmd
      .command('update <id>')
      .description('Enable or disable a rule')
      .requiredOption('--enabled <bool>', 'true or false')
  ).action(async (id, opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    const { event, partnership } = requireEventAndPartnership(g)
    const client = createClient({ test: g.test })
    const response = await withSpinner('Updating rule...', () =>
      client.patch(`${basePath(event, partnership, opts)}/${id}`, {
        task_completion_rule: { enabled: opts.enabled },
      })
    )
    printObject(response.data, { json: g.json })
  })

  parentOpts(cmd.command('delete <id>').description('Delete a rule')).action(async (id, opts, cmd) => {
    const g = getGlobalOpts(cmd)
    printBanner(g.test, g.json)
    if (!g.yes) await confirmOrExit(`Delete rule ${id}?`)
    const { event, partnership } = requireEventAndPartnership(g)
    const client = createClient({ test: g.test })
    await withSpinner('Deleting rule...', () =>
      client.delete(`${basePath(event, partnership, opts)}/${id}`)
    )
    printSuccess(`Rule ${id} deleted.`)
  })
}
