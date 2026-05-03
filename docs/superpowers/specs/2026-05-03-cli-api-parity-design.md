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

### Anomaly to remove

`src/commands/organizations.ts` (registered in `src/cli.ts`) calls `GET /api/v1/organizations`. **This endpoint does not exist in production** — it lives only on an unmerged feature branch. The CLI command is broken in the only environment it actually targets. Since no users are relying on the CLI today, the cleanest fix is to delete the command rather than carry a broken stub.

## Design

### Command surface

Three new command groups, plus one removal.

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

#### Removed: `phq organizations`

Delete:
- `src/commands/organizations.ts`
- The import on `src/cli.ts:9` (`registerOrganizationsCommands`)
- The registration on `src/cli.ts:45`
- The "Organizations" section in `README.md` (if present)

### Shared helpers

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
      ... (existing partner commands unchanged)
    organizations.ts        (DELETED)
    ... (other existing commands unchanged)
```

### README updates

- Add "Partner Chat", "Partner Invitations", and "Partner Uploads" sections under the existing partner-commands area, in the same tone and format as the other partner sections.
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
6. `phq organizations list` is gone (`phq --help` no longer mentions it).
7. `phq --help` and `phq partner --help` show the new groups.
