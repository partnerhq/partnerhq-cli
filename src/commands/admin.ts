import { Command } from 'commander'
import { createClient, withSpinner, PaginatedResponse } from '../api-client'
import { printList, printBanner } from '../output'
import { getGlobalOpts } from '../global-opts'

type Row = Record<string, any>

const person = (u: Row | null) => (u ? `${u.name} <${u.email}> (#${u.id})` : null)

export function registerAdminCommands(program: Command): void {
  const admin = program
    .command('admin')
    .description('PHQ admins: find users and projects (e.g. who to masquerade as)')

  admin
    .command('users')
    .description('Search users by name/email, customer (organization) or project')
    .option('--search <text>', 'Name or email (substring), or a user ID')
    .option('--organization <name|id>', 'Only members of this customer organization')
    .option('--project <name|permalink|id>', 'Only people on this project')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Searching users...', () =>
        client.get('/api/v1/admin/users', {
          params: { search: opts.search, organization: opts.organization, project: opts.project, page: opts.page, per_page: opts.perPage },
        })
      )
      const data = response.data as PaginatedResponse<Row>
      if (!g.json) {
        data.collection = data.collection.map((u) => ({
          ...u,
          organizations: u.organizations.map((o: Row) => o.name + (o.owner ? ' (owner)' : '')).join(', '),
        }))
      }
      printList(data, ['id', 'name', 'email', 'admin', 'organizations', 'current_sign_in_at'], { json: g.json })
    })

  admin
    .command('projects')
    .description('Search projects by name/permalink or customer, with each project\'s owner')
    .option('--search <text>', 'Project name (substring), exact permalink, or ID')
    .option('--organization <name|id>', 'Only projects owned by this customer organization')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 250)', '30')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const response = await fetchProjects(g.test, { search: opts.search, organization: opts.organization, page: opts.page, per_page: opts.perPage })
      if (!g.json) response.collection = response.collection.map(flattenProject)
      printList(response, ['id', 'name', 'permalink', 'organization', 'owner', 'archived_at', 'deactivated_at'], { json: g.json })
    })
}

export async function fetchProjects(test: boolean, params: Row): Promise<PaginatedResponse<Row>> {
  const client = createClient({ test })
  const response = await withSpinner('Searching projects...', () => client.get('/api/v1/admin/projects', { params }))
  return response.data as PaginatedResponse<Row>
}

export function flattenProject(p: Row): Row {
  return { ...p, organization: p.organization?.name ?? null, owner: person(p.owner) }
}
