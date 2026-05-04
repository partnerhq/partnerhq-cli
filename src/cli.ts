#!/usr/bin/env node

import { Command } from 'commander'
import { registerAuthCommands } from './commands/auth'
import { registerConfigCommands } from './commands/config'
import { registerWhoamiCommand } from './commands/whoami'
import { registerMyEventsCommands } from './commands/my-events'
import { registerEventsCommands } from './commands/events'
import { registerPartnershipsCommands } from './commands/partnerships'
import { registerOrgPartnershipsCommands } from './commands/org-partnerships'
import { registerTasksCommands } from './commands/tasks'
import { registerResourcesCommands } from './commands/resources'
import { registerInternalTasksCommands } from './commands/internal-tasks'
import { registerAnnouncementsCommands } from './commands/announcements'
import { registerTagsCommands } from './commands/tags'
import { registerTaskCompletionsCommands } from './commands/task-completions'
import { registerAuthorizationsCommands } from './commands/authorizations'
import { registerMessagesCommands } from './commands/messages'
import { registerInvitationsCommands } from './commands/invitations'
import { registerPartnerProfileCommands } from './commands/partner/profile'
import { registerPartnerOrgPartnershipsCommands } from './commands/partner/org-partnerships'
import { registerPartnerTaskCompletionsCommands } from './commands/partner/task-completions'
import { registerPartnerChatCommands } from './commands/partner/chat'

const program = new Command()

program
  .name('phq')
  .description('PartnerHQ CLI — manage your events, partnerships, tasks, and more')
  .version('0.2.0')
  .option('--test', 'Use the local dev environment (http://phq.test) instead of production')
  .option('--json', 'Output results as raw JSON')
  .option('--event <permalink>', 'Event permalink (overrides PHQ_EVENT env var)')
  .option('--partnership <id>', 'Your partnership ID (overrides PHQ_PARTNERSHIP env var)')
  .option('-y, --yes', 'Skip confirmation prompts (for scripting)')

// Utility commands
registerAuthCommands(program)
registerConfigCommands(program)
registerWhoamiCommand(program)

// Top-level commands (no event/partnership context required)
registerMyEventsCommands(program)
registerEventsCommands(program)

// Host-scoped resources (require --event + --partnership)
registerPartnershipsCommands(program)
registerOrgPartnershipsCommands(program)
registerTasksCommands(program)
registerResourcesCommands(program)
registerInternalTasksCommands(program)
registerAnnouncementsCommands(program)
registerTagsCommands(program)
registerTaskCompletionsCommands(program)
registerAuthorizationsCommands(program)
registerMessagesCommands(program)
registerInvitationsCommands(program)

// Partner sub-commands — grouped under `partner`
const partnerCmd = program
  .command('partner')
  .description('Manage your own data as a partner (profile, orgs, task assignments)')

registerPartnerProfileCommands(partnerCmd)
registerPartnerOrgPartnershipsCommands(partnerCmd)
registerPartnerTaskCompletionsCommands(partnerCmd)
registerPartnerChatCommands(partnerCmd)

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Unexpected error:', msg)
  process.exit(1)
})
