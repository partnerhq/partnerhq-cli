import { Command } from 'commander'
import { createClient, withSpinner, PaginatedResponse } from '../api-client'
import { printList, printBanner, printObject, printSuccess } from '../output'
import { getGlobalOpts } from '../global-opts'

type Row = Record<string, any>

const person = (u: Row | null) => (u ? `${u.name} <${u.email}> (#${u.id})` : null)

export function registerAdminCommands(program: Command): void {
  const admin = program
    .command('admin')
    .description('PHQ admins: find users and projects (e.g. who to masquerade as), create customer organizations')

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

  admin
    .command('organizations')
    .description('Manage customer (account-level) organizations')
    .command('create')
    .description('Create a customer organization. A new owner email creates the user and emails them a set-password link')
    .requiredOption('--name <name>', 'Organization name (must be unique)')
    .requiredOption('--owner-email <email>', 'Owner email; an existing user is reused as-is')
    .option('--owner-first-name <name>', 'Required when the owner is a new user')
    .option('--owner-last-name <name>', 'Required when the owner is a new user')
    .action(async (opts, cmd) => {
      const g = getGlobalOpts(cmd)
      printBanner(g.test, g.json)
      const client = createClient({ test: g.test })
      const response = await withSpinner('Creating organization...', () =>
        client.post('/api/v1/admin/organizations', {
          organization: {
            name: opts.name,
            owner_email: opts.ownerEmail,
            owner_first_name: opts.ownerFirstName,
            owner_last_name: opts.ownerLastName,
          },
        })
      )
      const org = response.data as Row
      if (g.json) return printObject(org, { json: true })
      printSuccess(`Created ${org.name} (${org.permalink}, #${org.id}) owned by ${person(org.owner)}`)
      console.log(org.password_email_sent
        ? 'New user: they get a confirm-email message and a set-password link (the link expires in 6 hours; resend with "Forgot password").'
        : 'Existing user set as owner; their login is unchanged.')
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
