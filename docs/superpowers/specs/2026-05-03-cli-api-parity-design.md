# CLI ↔ API Parity Update — Design

**Date:** 2026-05-03
**Status:** Approved (pending implementation plan)
**Source of truth:** Live production API docs at <https://app.partnerhq.com/developers>

## Goal

Bring `partnerhq-cli` to full parity with the live production PartnerHQ API. The CLI is not yet in use, so backwards compatibility is not a constraint — the directive is "do whatever updates are needed to make it work with the API."

## Gap Audit

### Already covered (no work needed)

| API resource | CLI command |
|---|---|
| Auth (`/oauth/token`, `/oauth/revoke`) | `phq auth login / logout / status` |
| My Events | `phq my-events list` |
| Events (CRUD) | `phq events get / create / update / delete` |
| Organization Partnerships (full) | `phq org-partnerships list / get / create / update / delete / retrieve` |
| Partnerships (full) | `phq partnerships list / get / create / update / delete / retrieve` |
| Tasks, Resources, Internal Tasks, Announcements, Tags (each: full CRUD) | `phq tasks / resources / internal-tasks / announcements / tags` |
| Task Completions (+ complete, reset) | `phq task-completions list / get / update / complete / reset` |
| Authorizations (+ bulk_update) | `phq authorizations list / get / update / bulk-update` |
| Messages (read) | `phq messages list / get` |
| Invitations (read) | `phq invitations list / get` |
| Partner Profile | `phq partner profile get / update` |
| Partner Organization Partnerships (read) | `phq partner org-partnerships list / get` |
| Partner Task Assignments (full) | `phq partner task-completions list / get / update / complete / reset` |

### Missing in CLI

**New endpoints (no CLI command at all):**

| API endpoint | Method | What it does |
|---|---|---|
| `/partner/chat_channels/:identifier` | GET | Show one chat channel + last 30 messages |
| `/partner/chat_channels/:identifier/messages` | GET | Paginated message history |
| `/partner/chat_channels/:identifier/create_message` | POST | Send a chat message |
| `/partner/organization_partnerships/:id/org_to_org_invitations` | POST | Invite another org as a teammate |
| `/partner/custom_field_file_uploads` | POST / GET | Upload + download a custom-field file |
| `/partner/images` | POST / GET | Upload + download an image |
| `/partner/videos` | POST / GET | Upload + download a video |
| `/partner/uploads` | POST / GET | Upload + download a generic file |

**Existing endpoints with new accepted fields (CLI command exists but doesn't expose them):**

| Endpoint | Newly-accepted fields |
|---|---|
| `PATCH /partner/profile` | `dismissed_welcome_message_at` |
| `POST/PATCH /tasks` | `custom_fields_attributes`, `inventories_attributes`, `organization_partnership_task_completions_attributes`, `descriptions_by_tags_attributes`, `referenced_task_ids`, `organization_tag_ids` (update only), `asset_ids` |
| `POST/PATCH /resources` | `custom_fields_attributes`, `resource_templates_attributes`, `organization_partnership_task_completions_attributes`, `descriptions_by_tags_attributes`, `organization_tag_ids`, `asset_ids` |
| `POST/PATCH /internal_tasks` | `auto_assign_to_partnership_id`, `assign_now_to_partnership_id`, `task_ids`, `referenced_task_ids`, `custom_fields_attributes`, `organization_partnership_task_completions_attributes` |

The nested-attribute fields (`*_attributes`) are deep, polymorphic structures (e.g. `custom_fields_attributes` accepts 9 field types with branching sub-options). They are unsuitable for flag-per-attribute CLI design.

### Anomaly to remove

`src/commands/organizations.ts` (registered in `src/cli.ts`) calls `GET /api/v1/organizations`. **This endpoint does not exist in production** — it lives only on an unmerged feature branch. The CLI command is broken in the only environment it actually targets. Since no users are relying on the CLI today, the cleanest fix is to delete the command rather than carry a broken stub.

## Design

### Command surface

Three new command groups, four extensions to existing groups, and one removal.

#### New: `phq partner chat`
File: `src/commands/partner/chat.ts`

```
phq partner chat show <identifier>
phq partner chat messages <identifier> [--page N] [--per-page N]
phq partner chat send <identifier> --text "<message>"
```

- `show` → `GET /api/v1/e/:event/p/:partnership/partner/chat_channels/:identifier`. The API's response embeds `chat_channel_messages` (the latest 30) and `partnerships_with_access`; the CLI prints both blocks. JSON mode passes the response through verbatim.
- `messages` → `GET …/chat_channels/:identifier/messages`. Standard paginated list. Columns: `id, created_at, partnership_id, text` (truncated at ~80 chars in table view).
- `send` → `POST …/chat_channels/:identifier/create_message` with body `{ message: { text } }`. Prints the created message.

The `<identifier>` is passed through to the API verbatim (no client-side resolution). The user obtains it from the web UI or another tool.

#### New: `phq partner invitations`
File: `src/commands/partner/invitations.ts`

```
phq partner invitations create <org-partnership-id> --email <email>
```

- `POST /api/v1/e/:event/p/:partnership/partner/organization_partnerships/:org_partnership_id/org_to_org_invitations` with `{ invitation: { email } }`.
- The API returns `400 Bad Request` when the event has teammate invitations disabled. The existing `api-client.ts` 400 handler surfaces this cleanly with no extra work.

#### New: `phq partner uploads`
File: `src/commands/partner/uploads.ts`

Four sibling subcommand groups, identical in shape:

```
phq partner uploads custom-field-file create --file <path>
phq partner uploads custom-field-file get    <id> [--output <path>]

phq partner uploads image            create --file <path>
phq partner uploads image            get    <id> [--output <path>]

phq partner uploads video            create --file <path>
phq partner uploads video            get    <id> [--output <path>]

phq partner uploads file             create --file <path>
phq partner uploads file             get    <id> [--output <path>]
```

API → CLI mapping:

| CLI subcommand | Endpoint | Multipart wrapper key |
|---|---|---|
| `custom-field-file` | `/partner/custom_field_file_uploads` | `custom_field_file_upload[file]` |
| `image` | `/partner/images` | `image[file]` |
| `video` | `/partner/videos` | `video[file]` |
| `file` | `/partner/uploads` | `upload[file]` |

Behavior:

- `create`: streams the file from `--file <path>` as `multipart/form-data` to the POST endpoint. Prints the API response (which includes a `link` field — the partner-API show URL).
- `get <id>`: issues `GET …/<id>` with `maxRedirects: 0`. The API responds with `303 See Other` and a signed S3 URL in `Location`.
  - With no `--output`: prints the signed URL to stdout (one line, no spinner artifacts — scriptable).
  - With `--output <path>`: follows the redirect and streams the response body to the local file. Prints `✓ Wrote <path>` on success.

The `id` parameter is the API's opaque token, not a database ID — the API uses `find_by(token: params[:id])`.

#### Extended: `phq partner profile update`

Add one new flag to the existing command:

```
phq partner profile update --dismissed-welcome-message-at <iso8601-datetime>
```

Maps to `PATCH /partner/profile` with `{ partnership: { dismissed_welcome_message_at: <value> } }` (or whatever wrapper key the existing command already uses — consistent with current pattern).

#### Extended: `phq tasks`, `phq resources`, `phq internal-tasks` (host CRUD)

Add a generic `--data <json|@file>` escape hatch to `create` and `update` on each of the three commands. Existing flags continue to work; `--data` merges arbitrary JSON into the request body.

```
phq tasks create --label "Booth Preferences" --data @./fields.json
phq tasks update <id> --data '{"task":{"custom_fields_attributes":[{"id":901,"_destroy":true}]}}'
phq resources create --label "Vendor Handbook" --data @./resource.json
phq internal-tasks create --label "Confirm catering" \
  --auto-assign-to-partnership-id 101 \
  --task-ids 12,34,56
```

Behavior:

- Argument forms: `--data '{"...":...}'` (literal JSON) or `--data @path/to/file.json` (read file).
- The CLI builds the request body from flags as it does today (e.g. `{ task: { label, description, ... } }`), then **deep-merges** the parsed `--data` JSON over it. Flag values win on conflict; `--data` provides everything else (nested arrays/objects pass through verbatim).
- Validation: parse-fail on invalid JSON with a clear error before any network call.
- The `--data` payload is the body wrapper itself (e.g. `{ "task": { ... } }`), not the inner attributes — matches what users will copy from the API docs.

**New scalar/array flags on `phq internal-tasks create / update`** (these are simple enough to deserve real flags, beyond `--data`):

- `--auto-assign-to-partnership-id <id>`
- `--assign-now-to-partnership-id <id>`
- `--task-ids <id,id,...>` (triggering task IDs)
- `--referenced-task-ids <id,id,...>`

No new flag-per-attribute coverage on `tasks` / `resources` beyond what already exists — the nested attributes go through `--data`.

#### Removed: `phq organizations`

Delete:
- `src/commands/organizations.ts`
- The import on `src/cli.ts:9` (`registerOrganizationsCommands`)
- The registration on `src/cli.ts:45`
- The "Organizations" section in `README.md` (if present)

### Shared helpers

New helpers for `--data` parsing in a new `src/data-flag.ts`:

```ts
// Parse `--data <value>`: if `value` starts with `@`, read from file; else parse literal.
// Throws with a clear error on invalid JSON or missing file.
function parseDataFlag(value: string): Record<string, unknown>

// Deep-merge two plain-object trees. Used to combine flag-built body with --data.
// Right operand wins on scalar conflict; arrays are replaced (not concatenated).
function deepMerge<T extends object>(base: T, overlay: Record<string, unknown>): T
```

Note on merge precedence: the spec's stated rule is "flags win on conflict." Implementation flips the merge order accordingly — flag-built body is the overlay, `--data` is the base.

New helpers in `src/api-client.ts`:

```ts
// Multipart POST client. Same auth + interceptors as createClient,
// but Content-Type set per-request by axios from the FormData boundary.
function createMultipartClient(opts: ApiOptions): AxiosInstance

// GET with maxRedirects: 0; returns the Location header value.
// Throws if status is not 3xx or Location is missing.
async function getRedirectLocation(
  client: AxiosInstance,
  path: string
): Promise<string>

// Streams a remote URL (signed S3 URL) to a local file path.
// Uses an unauthenticated axios instance — the URL is presigned.
async function downloadToFile(url: string, outputPath: string): Promise<void>
```

Error handling for these helpers reuses the existing 401/400/404/500 interceptors. Multipart requests need a tweak: the interceptor must not assume `Content-Type: application/json` on the request side (responses are still JSON).

### Dependencies

Add one runtime dependency:

- `form-data` — needed for streaming file uploads through axios. Node's built-in `FormData` works for in-memory data but doesn't integrate cleanly with axios streams.

No new dev dependencies.

### File layout after change

```
src/
  api-client.ts             (extended: multipart + redirect helpers)
  cli.ts                    (organizations import/registration removed; 3 new partner imports/registrations)
  commands/
    partner/
      chat.ts               (new)
      invitations.ts        (new)
      uploads.ts            (new)
      profile.ts            (extended: --dismissed-welcome-message-at)
      ... (other partner commands unchanged)
    tasks.ts                (extended: --data; deep-merge in create/update)
    resources.ts            (extended: --data; deep-merge in create/update)
    internal-tasks.ts       (extended: --data + 4 new scalar/array flags)
    organizations.ts        (DELETED)
    ... (other existing commands unchanged)
  data-flag.ts              (new: parseDataFlag + deepMerge)
```

### README updates

- Add "Partner Chat", "Partner Invitations", and "Partner Uploads" sections under the existing partner-commands area, in the same tone and format as the other partner sections.
- Add a "Power user: `--data`" subsection on `tasks`, `resources`, and `internal-tasks` showing how to construct nested-attribute payloads (custom fields, inventories, assignments). Link to the live `/developers` docs as the canonical schema.
- Note `--dismissed-welcome-message-at` under partner profile.
- Remove the organizations section.
- Bump the example list at the top to mention chat/uploads/invitations.

## Out of scope

- Test suite (the project has none today; not adding one as part of this update).
- Any non-API CLI improvements (config UX, shell completion, etc.).
- The `feature/organization-partnership-soft-deletion` work — irrelevant to the CLI surface (server-side soft delete is transparent to API consumers).
- Restoring `organizations list` if/when the My Organizations endpoint ships to production. That can be re-added when the endpoint actually lands.

## Risks and mitigations

- **Multipart upload edge cases.** Large files, missing files, permission errors. Mitigation: rely on Node's stream errors propagating through axios; the existing 500 handler surfaces server-side rejections; for missing local files, fail early with a clear "File not found: <path>" before opening the request.
- **Signed-URL redirect semantics.** S3 signed URLs include auth in the query string — re-sending the `Authorization: Bearer` header would be wrong. Mitigation: `downloadToFile` uses a fresh, unauthenticated axios instance (no token, no interceptor).
- **Identifier opacity for chat.** Without an index endpoint, users have to find identifiers elsewhere. Mitigation: documented in `--help` and README; `phq partner chat show` returns `partnerships_with_access`, which helps users orient.

## Verification plan

Manual, against the local dev server (`--test`, hitting `http://phq.test`):

1. `phq partner chat show <id>` returns channel + last 30 messages.
2. `phq partner chat messages <id> --per-page 5` paginates.
3. `phq partner chat send <id> --text "hello"` creates a message visible in the web UI.
4. `phq partner invitations create <op-id> --email new@example.com` creates an invitation; rejected with 400 when the event disables teammate invitations.
5. For each of the four upload kinds:
   - `create --file ./sample.ext` returns `{ link: "..." }` (or full record for custom-field-file).
   - `get <id>` prints a signed URL.
   - `get <id> --output ./out.ext` writes the file; bytes match the original.
6. `phq partner profile update --dismissed-welcome-message-at "2026-05-03T12:00:00Z"` succeeds and persists.
7. `phq tasks create --label "Booth" --data @./fields.json` (where `fields.json` contains a `task.custom_fields_attributes` payload) creates a task with custom fields; the same shape works for `tasks update`, `resources create/update`, and `internal-tasks create/update`.
8. `phq internal-tasks create --label "Confirm catering" --auto-assign-to-partnership-id 101 --task-ids 12,34,56` creates the record with the correct triggering tasks and assignment.
9. Conflict between `--data` and a flag: a flag value wins (verified by inspecting the persisted record).
10. `phq organizations list` is gone (`phq --help` no longer mentions it).
11. `phq --help` and `phq partner --help` show the new groups.
