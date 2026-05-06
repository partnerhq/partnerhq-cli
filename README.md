# PartnerHQ CLI

The official command-line interface for the [PartnerHQ](https://app.partnerhq.com) API. Manage your events, partnerships, tasks, resources, and more from your terminal or CI/CD pipelines.

You can invoke the CLI using either `partnerhq` or `phq` — they are identical.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Persistent Configuration](#persistent-configuration)
- [Environment Variables](#environment-variables)
- [Test Mode](#test-mode)
- [Global Options](#global-options)
- [Commands](#commands)
  - [auth](#auth)
  - [config](#config)
  - [whoami](#whoami)
  - [my-events](#my-events)
  - [my-organizations](#my-organizations)
  - [events](#events)
  - [partnerships](#partnerships)
  - [org-partnerships](#org-partnerships)
  - [tasks](#tasks)
  - [resources](#resources)
  - [internal-tasks](#internal-tasks)
  - [announcements](#announcements)
  - [tags](#tags)
  - [task-completions](#task-completions)
  - [authorizations](#authorizations)
  - [messages](#messages)
  - [invitations](#invitations)
  - [partner profile](#partner-profile)
  - [partner org-partnerships](#partner-org-partnerships)
  - [partner task-completions](#partner-task-completions)
  - [partner chat](#partner-chat)
  - [partner invitations](#partner-invitations)
  - [partner uploads](#partner-uploads)
- [Power user: --data for nested attributes](#power-user---data-for-nested-attributes)
- [Filtering with Ransack](#filtering-with-ransack)
- [Pagination](#pagination)
- [Output Modes](#output-modes)

---

## Installation

**Requirements:** Node.js 18 or later.

### From npm (once published)

```bash
npm install -g partnerhq-cli
```

### From source (local development)

```bash
# 1. Clone the repository
git clone https://github.com/partnerhq/partnerhq-cli.git
cd partnerhq-cli

# 2. Install dependencies
npm install

# 3. Build the TypeScript source
npm run build

# 4. Link the binaries globally so `phq` and `partnerhq` are available system-wide
npm link
```

To unlink later:

```bash
npm unlink -g partnerhq-cli
```

After installation, both `phq` and `partnerhq` are available:

```bash
phq --version
partnerhq --version
```

---

## Quick Start

```bash
# 1. Log in (interactive — prompts for email and password)
phq auth login

# 2. Save your default event and partnership so you don't have to type them every time
phq config set event acme-summit-2025
phq config set partnership 42

# 3. Start using the CLI
phq tasks list
phq partnerships list --filter "host_eq=true"
phq whoami
```

---

## Authentication

All API requests require an OAuth 2.0 Bearer token. Use `auth login` to obtain and store one.

### Interactive login (recommended)

```bash
phq auth login
```

You will be prompted for each credential one at a time:

1. **Client ID** -- your OAuth application's client ID
2. **Client Secret** -- your OAuth application's client secret (masked)
3. **Email** -- your PartnerHQ account email
4. **Password** -- your account password (masked)

The client ID and secret are saved per-environment in `~/.partnerhq/config.json`, so on subsequent logins you'll only be prompted for your email and password.

### Non-interactive login (CI/CD)

```bash
phq auth login --client-id <id> --client-secret <secret> --email you@example.com --password yourpassword
```

Your token is saved to `~/.partnerhq/config.json` and used automatically for all subsequent commands.

### Log out

```bash
phq auth logout
```

This revokes the token on the server and removes it from the local config.

### Check status

Shows authentication status for **both** environments at once:

```bash
phq auth status
```

```
┌────────────┬─────────────────┬───────────────────────────┬──────────────────┐
│ production │ ✓ Authenticated │ https://app.partnerhq.com │ abc12345...xyz9  │
├────────────┼─────────────────┼───────────────────────────┼──────────────────┤
│ test       │ ✗ Not logged in │ http://phq.test           │ —                │
└────────────┴─────────────────┴───────────────────────────┴──────────────────┘

  Active: production
```

---

## Persistent Configuration

Save defaults so you don't have to pass `--event`, `--partnership`, or `--test` on every command.

```bash
# Save your working event and partnership
phq config set event acme-summit-2025
phq config set partnership 42

# Enable persistent test mode
phq config set test true

# Now these are equivalent:
phq tasks list
phq tasks list --event acme-summit-2025 --partnership 42 --test

# View all saved defaults
phq config list

# Remove a single default
phq config unset event

# Clear all defaults (tokens are preserved)
phq config clear
```

The priority chain for all options is: **CLI flag > environment variable > saved config default**.

See your full resolved context at any time:

```bash
phq whoami
```

---

## Environment Variables

These variables override saved config values. Useful in CI/CD pipelines.

| Variable          | Description                                                  |
|-------------------|--------------------------------------------------------------|
| `PHQ_API_KEY`     | OAuth Bearer token (overrides saved token)                   |
| `PHQ_EVENT`       | Default event permalink (overrides saved config)             |
| `PHQ_PARTNERSHIP` | Default partnership ID (overrides saved config)              |
| `PHQ_TEST`        | Set to `1` or `true` to enable test mode                     |

**Example — CI pipeline:**

```bash
export PHQ_API_KEY=your_token
export PHQ_EVENT=acme-summit-2025
export PHQ_PARTNERSHIP=42

phq tasks list --filter "status_filter=published"
```

---

## Test Mode

Point the CLI at your local development environment (`http://phq.test`) instead of production (`https://app.partnerhq.com`). There are three ways to enable it:

```bash
# 1. Per-command flag
phq tasks list --test

# 2. Environment variable
PHQ_TEST=1 phq tasks list

# 3. Persistent (stays on until you turn it off)
phq config set test true
```

When test mode is active, a yellow **TEST MODE** banner is displayed before any output so you always know where your commands are going.

Test mode uses a **separate token** stored in `~/.partnerhq/config.json`, so your production credentials are never overwritten. Log in to each environment independently:

```bash
phq auth login              # logs in to production
phq auth login --test       # logs in to local dev
```

**Config file structure:**

```json
{
  "production": { "token": "...", "client_id": "...", "client_secret": "..." },
  "test":       { "token": "...", "client_id": "...", "client_secret": "..." },
  "defaults":   { "event": "acme-summit-2025", "partnership": "42", "test": false }
}
```

---

## Global Options

These options are available on every command:

| Option                   | Description                                              |
|--------------------------|----------------------------------------------------------|
| `--test`                 | Use local dev environment (`http://phq.test`)            |
| `--json`                 | Output raw JSON instead of a formatted table             |
| `--event <permalink>`    | Event permalink (overrides `PHQ_EVENT` and saved config) |
| `--partnership <id>`     | Partnership ID (overrides `PHQ_PARTNERSHIP` and saved config) |
| `-y, --yes`              | Skip confirmation prompts (for scripting)                |

---

## Commands

Most resource commands require an event permalink and a partnership ID. These can be supplied via `--event`/`--partnership` flags, `PHQ_EVENT`/`PHQ_PARTNERSHIP` environment variables, or saved via `phq config set`.

Destructive commands (`delete`) will ask for confirmation before proceeding. Pass `--yes` or `-y` to skip the prompt.

---

### auth

Manage authentication.

```bash
# Interactive login (prompts for client ID, secret, email, password)
phq auth login [--test]

# Non-interactive login (for CI/CD)
phq auth login --client-id <id> --client-secret <secret> --email <email> --password <password> [--test]

phq auth logout [--test]
phq auth status
```

---

### config

Manage persistent CLI defaults.

```bash
phq config set <key> <value>   # Set a default (keys: event, partnership, test)
phq config get <key>           # Get the current value of a default
phq config unset <key>         # Remove a single default
phq config list                # Show all saved defaults
phq config clear               # Remove all defaults (keeps tokens)
```

**Examples:**

```bash
phq config set event acme-summit-2025
phq config set partnership 42
phq config set test true
phq config list
phq config unset test
```

---

### whoami

Show your full current CLI context at a glance, including which user the stored token belongs to. When authenticated, `whoami` calls `GET /api/v1/me` to fetch identity (name, email, user ID, admin flag); on network failure or rejected tokens it degrades to a local-only view rather than exiting with an error.

```bash
phq whoami [--json]
```

```
┌──────────────┬───────────────────────────────┐
│ Logged in as │ Jane Smith <jane@example.com> │
├──────────────┼───────────────────────────────┤
│ User ID      │ 200                           │
├──────────────┼───────────────────────────────┤
│ Admin        │ —                             │
└──────────────┴───────────────────────────────┘
┌─────────────┬────────────────────────────────────────┐
│ Environment │ production (https://app.partnerhq.com) │
├─────────────┼────────────────────────────────────────┤
│ Token       │ ✓ abc12345...xyz9                      │
├─────────────┼────────────────────────────────────────┤
│ Event       │ acme-summit-2025                       │
├─────────────┼────────────────────────────────────────┤
│ Partnership │ 42                                     │
└─────────────┴────────────────────────────────────────┘
```

The `--json` form returns the same data as a structured object — useful in CI/scripting:

```json
{
  "environment": "production",
  "base_url": "https://app.partnerhq.com",
  "authenticated": true,
  "identity": { "id": 200, "name": "Jane Smith", "email": "jane@example.com", "admin": false },
  "identity_error": null,
  "event": "acme-summit-2025",
  "partnership": "42"
}
```

If the API is unreachable or the token is rejected, `identity` is `null` and `identity_error` describes why — `authenticated: true` still indicates a token is stored locally.

---

### my-events

List all events the authenticated user belongs to (no event/partnership context required).

```bash
phq my-events list [--page N] [--per-page N] [--json]
```

---

### my-organizations

List all organizations the authenticated user is a member of (no event/partnership context required). Returns each organization's `id`, `name`, `permalink`, plus the `owner` (whether the user owns the organization) and `current` (whether it's the user's currently active organization) flags. Use the `organization_id` values when creating a new event — `owner_organization_id` must reference an organization the user belongs to.

```bash
phq my-organizations list [--page N] [--per-page N] [--json]
```

---

### events

Manage events (projects). These commands do **not** require `--event`/`--partnership`.

```bash
# Get an event by permalink
phq events get <permalink> [--json]

# Create a new event
phq events create --name "Acme Summit 2025" [--welcome-message "Welcome!"] [--brand-color "#FF5733"]

# Update an event
phq events update <permalink> [--name "New Name"] [--welcome-message "..."] [--brand-color "#000000"]

# Delete an event (will ask for confirmation)
phq events delete <permalink>

# Skip confirmation (scripting)
phq events delete <permalink> --yes
```

---

### partnerships

Manage people (partners and hosts) within an event.

```bash
phq partnerships list   --event <permalink> --partnership <id> [--filter "..."] [--page N] [--per-page N] [--sort "field asc"]
phq partnerships get    <id>   --event <permalink> --partnership <id>
phq partnerships create --event <permalink> --partnership <id> --first-name <name> --last-name <name> --email <email> [--host] [--read-only] [--notes "..."]
phq partnerships update <id>   --event <permalink> --partnership <id> [--first-name <name>] [--email <email>] [--host true|false] [--read-only true|false]
phq partnerships delete <id>   --event <permalink> --partnership <id>

# Find or create by name + email (idempotent)
phq partnerships retrieve --event <permalink> --partnership <id> --first-name <name> --last-name <name> --email <email>
```

**Example filters:**

```bash
phq partnerships list --event acme-2025 --partnership 1 --filter "host_eq=true"
phq partnerships list --event acme-2025 --partnership 1 --filter "email_cont=@acme.com"
phq partnerships list --event acme-2025 --partnership 1 --filter "first_name_cont=jane" --filter "read_only_eq=false"
```

---

### org-partnerships

Manage organizations within an event.

```bash
phq org-partnerships list    --event <permalink> --partnership <id> [--filter "..."] [--page N] [--per-page N]
phq org-partnerships get     <id>   --event <permalink> --partnership <id>
phq org-partnerships create  --event <permalink> --partnership <id> --name <name> [--host]
phq org-partnerships update  <id>   --event <permalink> --partnership <id> [--name <name>] [--host true|false]
phq org-partnerships delete  <id>   --event <permalink> --partnership <id>

# Find or create by name (idempotent)
phq org-partnerships retrieve --event <permalink> --partnership <id> --name <name>
```

**Example filters:**

```bash
# Only non-archived orgs
phq org-partnerships list --event acme-2025 --partnership 1 --filter "archived_at_null=1"

# Orgs with no connected users (Ransack scope)
phq org-partnerships list --event acme-2025 --partnership 1 --filter "no_connected_users=1"

# Host organizations only
phq org-partnerships list --event acme-2025 --partnership 1 --filter "host_eq=true"
```

---

### tasks

Manage to-do tasks within an event.

```bash
phq tasks list    --event <permalink> --partnership <id> [--filter "..."] [--page N] [--per-page N] [--sort "position asc"]
phq tasks get     <id>   --event <permalink> --partnership <id>
phq tasks create  --event <permalink> --partnership <id> --label <label> [--description "..."] [--due-at "2025-06-01T00:00:00Z"] [--pinned] [--locked] [--advance] [--notify-hosts] [--go-to-link <url>] [--data <json|@file>]
phq tasks update  <id>   --event <permalink> --partnership <id> [--label <label>] [--pinned true|false] [--locked true|false] [--data <json|@file>]
phq tasks delete  <id>   --event <permalink> --partnership <id>
```

**Example filters:**

```bash
# Published tasks only (Ransack scope)
phq tasks list --event acme-2025 --partnership 1 --filter "status_filter=published"

# Draft tasks only
phq tasks list --event acme-2025 --partnership 1 --filter "status_filter=draft"

# Archived tasks
phq tasks list --event acme-2025 --partnership 1 --filter "status_filter=archived"

# Multiple statuses (Ransack scope)
phq tasks list --event acme-2025 --partnership 1 --filter "status_in[]=published" --filter "status_in[]=draft"

# Pinned tasks
phq tasks list --event acme-2025 --partnership 1 --filter "pinned_eq=true"

# Tasks with overdue completions (Ransack scope)
phq tasks list --event acme-2025 --partnership 1 --filter "with_overdue_completions=1"

# Tasks due before a date
phq tasks list --event acme-2025 --partnership 1 --filter "due_at_lt=2025-07-01"

# Tasks containing a keyword
phq tasks list --event acme-2025 --partnership 1 --filter "label_cont=onboarding"
```

---

### resources

Manage resource tasks (links, documents) within an event. Resources are a subtype of tasks.

```bash
phq resources list    --event <permalink> --partnership <id> [--filter "..."]
phq resources get     <id>   --event <permalink> --partnership <id>
phq resources create  --event <permalink> --partnership <id> --label <label> [--go-to-link <url>] [--go-to-link-instructions "..."] [--description "..."] [--pinned] [--locked] [--data <json|@file>]
phq resources update  <id>   --event <permalink> --partnership <id> [--label <label>] [--go-to-link <url>] [--data <json|@file>]
phq resources delete  <id>   --event <permalink> --partnership <id>
```

Resources support the same filters as [tasks](#tasks) since they share the same underlying model.

---

### internal-tasks

Manage internal (host-only) tasks within an event.

```bash
phq internal-tasks list    --event <permalink> --partnership <id> [--filter "..."]
phq internal-tasks get     <id>   --event <permalink> --partnership <id>
phq internal-tasks create  --event <permalink> --partnership <id> --label <label> [--description "..."] [--due-at "..."] [--pinned] [--locked] \
  [--auto-assign-to-partnership-id <id>] [--assign-now-to-partnership-id <id>] [--task-ids <id,...>] [--referenced-task-ids <id,...>] [--data <json|@file>]
phq internal-tasks update  <id>   --event <permalink> --partnership <id> [--label <label>] [--pinned true|false] \
  [--auto-assign-to-partnership-id <id>] [--assign-now-to-partnership-id <id>] [--task-ids <id,...>] [--referenced-task-ids <id,...>] [--data <json|@file>]
phq internal-tasks delete  <id>   --event <permalink> --partnership <id>
```

---

### announcements

Manage announcements within an event. Sent announcements are immutable.

```bash
phq announcements list    --event <permalink> --partnership <id> [--filter "..."]
phq announcements get     <id>   --event <permalink> --partnership <id>
phq announcements create  --event <permalink> --partnership <id> --text "Message body" [--segment all|completed|incomplete|overdue] [--scheduled-at "2025-06-01T09:00:00Z"] [--notify all|task|tag|organization_partnership]
phq announcements update  <id>   --event <permalink> --partnership <id> [--text "..."] [--segment "..."] [--scheduled-at "..."]
phq announcements delete  <id>   --event <permalink> --partnership <id>
```

> **Note:** Omitting `--scheduled-at` sends the announcement immediately (`schedule_now: true`).

**Segment values:**

| Value                    | Recipients                                  |
|--------------------------|---------------------------------------------|
| `all`                    | Everyone (default)                          |
| `completed`              | Partners who completed the linked task      |
| `incomplete`             | Partners who have not completed the task    |
| `overdue`                | Partners with overdue completions           |
| `organization_partnerships` | Members of specific organizations        |
| `partnerships`           | Specific individual partnerships            |

---

### tags

Manage tags within an event.

```bash
phq tags list    --event <permalink> --partnership <id> [--filter "..."]
phq tags get     <id>   --event <permalink> --partnership <id>
phq tags create  --event <permalink> --partnership <id> --name <name> [--hex-color "#FF5733"] [--font-color "#FFFFFF"]
phq tags update  <id>   --event <permalink> --partnership <id> [--name <name>] [--hex-color "#..."] [--font-color "#..."]
phq tags delete  <id>   --event <permalink> --partnership <id>
```

**Example filters:**

```bash
# Unused tags (Ransack scope — tags with no active taggings)
phq tags list --event acme-2025 --partnership 1 --filter "unused=1"

# Tags matching a name
phq tags list --event acme-2025 --partnership 1 --filter "name_cont=sponsor"
```

---

### task-completions

Manage task assignment records (which orgs/partners are assigned to which tasks). Task completions cannot be created or deleted directly — they are created automatically when tasks are assigned.

```bash
phq task-completions list     --event <permalink> --partnership <id> [--filter "..."] [--sort "due_at asc"]
phq task-completions get      <id>   --event <permalink> --partnership <id>
phq task-completions update   <id>   --event <permalink> --partnership <id> [--enabled true|false] [--due-at "..."] [--assigned-partnership-id <id>]
phq task-completions complete <id>   --event <permalink> --partnership <id>
phq task-completions reset    <id>   --event <permalink> --partnership <id>
```

**Example filters:**

```bash
# Enabled (active) assignments only
phq task-completions list --event acme-2025 --partnership 1 --filter "enabled_eq=true"

# Completed assignments
phq task-completions list --event acme-2025 --partnership 1 --filter "completed_at_not_null=1"

# Incomplete assignments
phq task-completions list --event acme-2025 --partnership 1 --filter "completed_at_null=1"

# Assignments for a specific task
phq task-completions list --event acme-2025 --partnership 1 --filter "task_id_eq=123"

# Assignments for a specific organization
phq task-completions list --event acme-2025 --partnership 1 --filter "partnerable_type_eq=OrganizationPartnership" --filter "partnerable_id_eq=456"

# Overdue assignments
phq task-completions list --event acme-2025 --partnership 1 --filter "enabled_eq=true" --filter "completed_at_null=1" --filter "due_at_lt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

---

### authorizations

Manage per-partner permission records. Authorizations cannot be created or deleted — they are managed automatically.

```bash
phq authorizations list         --event <permalink> --partnership <id> [--filter "..."]
phq authorizations get          <id>   --event <permalink> --partnership <id>
phq authorizations update       <id>   --event <permalink> --partnership <id> [--can-view true|false] [--can-notify true|false] [--can-edit true|false]

# Update multiple authorizations in one request
phq authorizations bulk-update  --event <permalink> --partnership <id> \
  --data '[{"id": 1, "can_view": true}, {"id": 2, "can_notify": false}]'
```

**Example filters:**

```bash
phq authorizations list --event acme-2025 --partnership 1 --filter "can_view_eq=true"
phq authorizations list --event acme-2025 --partnership 1 --filter "item_type_eq=OrganizationPartnership"
```

---

### messages

Read chat messages within an event (read-only).

```bash
phq messages list --event <permalink> --partnership <id> [--filter "..."] [--sort "created_at desc"]
phq messages get  <id>   --event <permalink> --partnership <id>
```

**Example filters:**

```bash
# Exclude bot messages (Ransack scope)
phq messages list --event acme-2025 --partnership 1 --filter "non_bot=1"

# Messages containing text
phq messages list --event acme-2025 --partnership 1 --filter "text_cont=hello"
```

---

### invitations

Read invitations within an event (read-only).

```bash
phq invitations list --event <permalink> --partnership <id> [--filter "..."]
phq invitations get  <id>   --event <permalink> --partnership <id>
```

**Example filters:**

```bash
# Pending invitations only
phq invitations list --event acme-2025 --partnership 1 --filter "state_eq=pending"

# Invitations by email
phq invitations list --event acme-2025 --partnership 1 --filter "email_cont=@acme.com"
```

---

### partner profile

View and update your own profile as a partner within an event.

```bash
phq partner profile get    --event <permalink> --partnership <id>
phq partner profile update --event <permalink> --partnership <id> \
  [--first-name <name>] [--last-name <name>] \
  [--notify-for-new-chats true|false] \
  [--notify-for-completed-tasks true|false] \
  [--notify-for-task-reminders true|false] \
  [--dismissed-welcome-message-at "2025-06-01T00:00:00Z"]
```

---

### partner org-partnerships

View organizations you belong to (as a partner, read-only).

```bash
phq partner org-partnerships list --event <permalink> --partnership <id> [--filter "..."]
phq partner org-partnerships get  <id>   --event <permalink> --partnership <id>
```

---

### partner task-completions

View and interact with your own task assignments as a partner.

```bash
phq partner task-completions list     --event <permalink> --partnership <id> [--filter "..."]
phq partner task-completions get      <id>   --event <permalink> --partnership <id>
phq partner task-completions update   <id>   --event <permalink> --partnership <id> [--due-at "..."]
phq partner task-completions complete <id>   --event <permalink> --partnership <id>
phq partner task-completions reset    <id>   --event <permalink> --partnership <id>
```

---

### partner chat

Read and write chat channels you have access to as a partner.

```bash
phq partner chat show     <identifier>   --event <permalink> --partnership <id>
phq partner chat messages <identifier>   --event <permalink> --partnership <id> [--page N] [--per-page N]
phq partner chat send     <identifier>   --event <permalink> --partnership <id> --text "Hello team!"
```

The `<identifier>` is the channel identifier from the API. Find it via the web UI or from the `partnerships_with_access` field returned by `phq partner chat show`.

---

### partner invitations

Invite another organization to join your organization as a teammate (subject to event settings).

```bash
phq partner invitations create <organization-partnership-id> --event <permalink> --partnership <id> --email new@example.com
```

Returns `400 Bad Request` if the event has teammate invitations disabled.

---

### partner uploads

Upload and download four kinds of files. All four sub-resources share the same `create`/`get` shape.

```bash
# Custom-field file
phq partner uploads custom-field-file create --event <permalink> --partnership <id> --file ./receipt.pdf
phq partner uploads custom-field-file get    <id> --event <permalink> --partnership <id> [--output ./receipt.pdf]

# Image
phq partner uploads image create --event <permalink> --partnership <id> --file ./photo.jpg
phq partner uploads image get    <id> --event <permalink> --partnership <id> [--output ./photo.jpg]

# Video
phq partner uploads video create --event <permalink> --partnership <id> --file ./demo.mp4
phq partner uploads video get    <id> --event <permalink> --partnership <id> [--output ./demo.mp4]

# Generic file
phq partner uploads file create --event <permalink> --partnership <id> --file ./report.pdf
phq partner uploads file get    <id> --event <permalink> --partnership <id> [--output ./report.pdf]
```

`get` without `--output` prints a signed URL to stdout (scriptable). With `--output <path>`, follows the redirect and saves the file locally.

---

## Power user: --data for nested attributes

`tasks`, `resources`, and `internal-tasks` accept a `--data` flag on `create` and `update` for any field not exposed as a top-level CLI flag (custom fields, inventories, organization assignments, descriptions-by-tags, asset/tag IDs, etc.). The value is JSON — either a literal string or `@path/to/file.json`.

The CLI builds the request body from your named flags and then deep-merges your `--data` payload into it. **Named flag values win on conflict.** Arrays are replaced, not concatenated.

```bash
# Build the JSON in a file (lets you template / version-control it)
cat > fields.json <<'EOF'
{
  "task": {
    "custom_fields_attributes": [
      { "type": "CustomFields::Text",   "name": "Legal name", "position": "1", "required": "true" },
      { "type": "CustomFields::Select", "name": "Booth size",  "position": "2", "text_options": "Small\nMedium\nLarge" }
    ]
  }
}
EOF
phq tasks create --event acme-2025 --partnership 1 --label "Booth Preferences" --data @./fields.json

# Or pass JSON inline
phq tasks update 302 --event acme-2025 --partnership 1 \
  --data '{"task":{"custom_fields_attributes":[{"id":901,"_destroy":true}]}}'
```

The same pattern applies to `resources` and `internal-tasks`:

```bash
phq resources create --event acme-2025 --partnership 1 --label "Press Kit" --data @./resource_fields.json
phq internal-tasks update 55 --event acme-2025 --partnership 1 --data '{"internal_task":{"description":"Updated via CLI"}}'
```

See the live API docs at <https://app.partnerhq.com/developers> for the full list of accepted nested attributes and types.

---

## Filtering with Ransack

All `list` commands support powerful server-side filtering via the `--filter` flag. You can pass multiple `--filter` flags and they are ANDed together.

```bash
phq tasks list --event acme-2025 --partnership 1 \
  --filter "label_cont=onboarding" \
  --filter "pinned_eq=true"
```

Filters use the format `predicate=value`, where the predicate is a Ransack search predicate.

### Standard Ransack Predicates

These work on any column of the resource (use the exact database column name as the field part):

| Predicate         | Description                                                        | Example                              |
|-------------------|--------------------------------------------------------------------|--------------------------------------|
| `_eq`             | Exact match                                                        | `host_eq=true`                       |
| `_not_eq`         | Not equal                                                          | `state_not_eq=pending`               |
| `_cont`           | Contains (case-insensitive)                                        | `label_cont=signup`                  |
| `_not_cont`       | Does not contain                                                   | `email_not_cont=@spam.com`           |
| `_start`          | Starts with                                                        | `name_start=Acme`                    |
| `_end`            | Ends with                                                          | `email_end=.org`                     |
| `_matches`        | SQL LIKE pattern (`%` wildcard)                                    | `name_matches=%Corp%`                |
| `_gt`             | Greater than                                                       | `due_at_gt=2025-01-01`               |
| `_gteq`           | Greater than or equal                                              | `due_at_gteq=2025-01-01`             |
| `_lt`             | Less than                                                          | `due_at_lt=2025-12-31`               |
| `_lteq`           | Less than or equal                                                 | `created_at_lteq=2025-06-01`         |
| `_null`           | Is NULL (value is ignored)                                         | `completed_at_null=1`                |
| `_not_null`       | Is NOT NULL (value is ignored)                                     | `completed_at_not_null=1`            |
| `_in`             | In a comma-separated list                                          | `id_in=1,2,3`                        |
| `_not_in`         | Not in a comma-separated list                                      | `id_not_in=4,5`                      |
| `_true`           | Is true (boolean shorthand)                                        | `pinned_true=1`                      |
| `_false`          | Is false (boolean shorthand)                                       | `locked_false=1`                     |

### Sorting

Use `--sort` to control the result order:

```bash
phq tasks list --event acme-2025 --partnership 1 --sort "created_at desc"
phq tasks list --event acme-2025 --partnership 1 --sort "label asc"
phq partnerships list --event acme-2025 --partnership 1 --sort "last_name asc"
```

### Per-Resource Ransack Scopes

These are named scopes exposed specifically by each model. Pass the scope name as the predicate and any required value.

#### Tasks, Resources, InternalTasks

| Scope                      | Value                                   | Description                                                     |
|----------------------------|-----------------------------------------|-----------------------------------------------------------------|
| `status_filter`            | `published`, `draft`, `archived`        | Filter by publication/archival status                           |
| `status_in[]`              | `published`, `draft`, `archived`        | Match any of the given statuses (pass multiple filters)         |
| `with_overdue_completions` | `1` (any truthy value)                  | Tasks that have at least one enabled, incomplete, overdue assignment |

```bash
# Draft tasks
phq tasks list --event acme-2025 --partnership 1 --filter "status_filter=draft"

# Published OR archived
phq tasks list --event acme-2025 --partnership 1 \
  --filter "status_in[]=published" --filter "status_in[]=archived"

# Tasks with overdue completions
phq tasks list --event acme-2025 --partnership 1 --filter "with_overdue_completions=1"
```

#### Tags

| Scope    | Value                  | Description                                                  |
|----------|------------------------|--------------------------------------------------------------|
| `unused` | `1` (any truthy value) | Tags that have no active taggings (no orgs, no active tasks) |

```bash
phq tags list --event acme-2025 --partnership 1 --filter "unused=1"
```

#### OrganizationPartnerships

| Scope                | Value                  | Description                                                        |
|----------------------|------------------------|--------------------------------------------------------------------|
| `no_connected_users` | `1` (any truthy value) | Organizations where no member partnerships have a connected user account |

```bash
phq org-partnerships list --event acme-2025 --partnership 1 --filter "no_connected_users=1"
```

#### Messages

| Scope     | Value                  | Description                              |
|-----------|------------------------|------------------------------------------|
| `non_bot` | `1` (any truthy value) | Exclude messages sent by bot partnerships |

```bash
phq messages list --event acme-2025 --partnership 1 --filter "non_bot=1"
```

### Filterable Columns by Resource

Below is a reference of the most useful filterable columns for each resource.

#### Partnerships

`id`, `first_name`, `last_name`, `email`, `host`, `read_only`, `owner`, `bot`, `user_id`, `notes`, `notify_for_new_chats`, `notify_for_completed_tasks`, `notify_for_task_reminders`, `created_at`, `updated_at`

#### OrganizationPartnerships

`id`, `name`, `host`, `archived_at`, `created_at`, `updated_at`

#### Tasks / Resources / InternalTasks

`id`, `label`, `description`, `type`, `pinned`, `locked`, `advance`, `due_at`, `published_at`, `archived`, `position`, `notify_hosts_on_completion`, `go_to_link`, `has_go_to_link`, `created_at`, `updated_at`

#### TaskCompletions

`id`, `task_id`, `partnerable_type`, `partnerable_id`, `enabled`, `completed_at`, `due_at`, `assigned_partnership_id`, `state`, `created_at`, `updated_at`

#### Announcements

`id`, `text`, `segment`, `scheduled_at`, `published_at`, `notify`, `created_at`, `updated_at`

#### Tags

`id`, `name`, `hex_color`, `font_color`, `created_at`, `updated_at`

#### Messages

`id`, `text`, `name`, `welcome_message`, `created_at`, `updated_at`

#### Invitations

`id`, `email`, `state`, `type`, `short_code`, `created_at`, `updated_at`

#### Authorizations

`id`, `can_view`, `can_notify`, `can_edit`, `item_type`, `created_at`, `updated_at`

---

## Pagination

All `list` commands support `--page` and `--per-page`:

```bash
phq partnerships list --event acme-2025 --partnership 1 --page 2 --per-page 50
```

- Default: `--page 1`, `--per-page 30`
- Maximum: `--per-page 250`

The table footer shows pagination info: `Page 1 · 30 of 142 total (30 per page)`.

---

## Output Modes

By default, results are displayed as formatted tables. Add `--json` to any command to get raw JSON output — useful for piping into `jq` or other tools.

```bash
# Formatted table (default)
phq tasks list --event acme-2025 --partnership 1

# Raw JSON
phq tasks list --event acme-2025 --partnership 1 --json

# Pipe into jq
phq tasks list --event acme-2025 --partnership 1 --json | jq '.collection[].label'
```
