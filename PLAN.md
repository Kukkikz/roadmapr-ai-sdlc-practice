# Roadmapr — Feedback & Roadmap Board (Practice Demo)

A multi-tenant feedback board where teams collect ideas, let visitors upvote anonymously, and publish a roadmap (planned / in progress / shipped). Fictional product, built to practice the full AI-coding-agent SDLC.

## Business Goals

- Let teams collect and prioritise customer feedback in one place
- Make it effortless for visitors to participate (no sign-in to submit or vote)
- Show customers what is planned, in progress and shipped to build trust

## Tech Stack

- Next.js (App Router, TypeScript) deployed on Vercel
- DB: PGlite (in-process Postgres) for local dev and tests, Neon (Postgres) in production — see `docs/adr/0001-pglite-local-postgres-everywhere.md`
- ORM/migrations: Drizzle, single `pg-core` schema
- Auth (team members only): secret links (no email, no passwords) — owner link, member invite link; private boards via board share link
- Frontend design: Google Stitch (design system exported to `DESIGN.md`, connected via Stitch MCP)
- Testing: Vitest (unit/integration), Playwright (E2E)
- CI: GitHub Actions

## Roles

| Role        | Sign-in                                                           | Can do                                                                                                      |
| ----------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Visitor     | None (anonymous cookie); private boards need the board share link | Browse board, submit ideas, upvote, comment                                                                 |
| Team member | Member invite link (picks a display name)                         | All visitor actions + change status, manage tags, hide ideas, reply as team                                 |
| Team owner  | Owner link (shown once when the team is created)                  | All member actions + create/revoke invite and share links, remove members, manage boards and board settings |

## Data Model

Full ER diagram, constraints and indexes: [`docs/database-er-diagram.md`](docs/database-er-diagram.md).

- `teams` (id, name, slug)
- `members` (id, team_id, display_name, role: owner | member, removed_at nullable)
- `boards` (id, team_id, name, slug, description, visibility: public | private)
- `ideas` (id, board_id, title, description, status, actor_id, author_name nullable, hidden, reviewed_at nullable, created_at)
- `votes` (idea_id, actor_id, created_at) — unique (idea_id, actor_id)
- `comments` (id, idea_id, body, actor_id, author_name nullable, hidden, created_at)
- `idea_status_events` (idea_id, actor_id, from_status, to_status, created_at)
- `tags` (id, board_id, name, color) and `idea_tags` (idea_id, tag_id)
- `access_links` (id, team_id, board_id nullable, member_id nullable, kind: owner | member_invite | board_share, hashed token, expires_at nullable, revoked_at nullable)
- `sessions` (hashed token, member_id, expires_at)
- `rate_limits` (key, window_start, count)

`actor_id` is `anon:<cookie-id>` or `member:<member-id>`. Owner links are bound to the owner's `member_id` and can start a session on any device; member invite links create a new member when redeemed; board share links grant a visitor access to one private board (recorded in the visitor's signed cookie). Statuses: open, planned, in_progress, shipped, declined (plain text + check constraint, no native enum). Deleting a team or board is a hard delete that cascades down the tree; members are only soft-removed (`removed_at`) so history keeps their display name.

---

## Phase 0: Planning & Setup

### Scope & Spec

- [x] Confirm MVP scope and out-of-scope list (see bottom of this file)
- [x] Write user stories with acceptance criteria in `SPEC.md`
- [x] Create `AGENTS.md` / `CLAUDE.md` with project conventions, commands and definition of done

### Project Scaffolding

- [x] Initialise Next.js + TypeScript + ESLint + Prettier (Vitest and Playwright smoke tests included)
- [ ] Set up Drizzle with PGlite for local dev (done: PGlite migrations and tests pass, and the same tests pass on real Postgres in CI; still to verify: the Neon driver against a real Neon database)
- [x] Add `.env.example` and env validation (zod)
- [x] Set up GitHub repo, branch protection, and CI skeleton (public repo `Kukkikz/roadmapr-ai-sdlc-practice`; `main` requires a PR and the three CI checks, no force-push, linear history, applies to admins)

---

## Phase 1: Design (Stitch)

### Design System

- [x] Define brand tone, colours, typography in Stitch (`DESIGN.md` uploaded; Stitch project "Roadmapr" id `7208899953600583130`, the only design system is `5046df3c154341a381a0748a09305b70`; the duplicate `14df3a9e…` was deleted in the Stitch UI. Re-uploading `DESIGN.md` creates a new design system each time, and the CLI cannot delete one)
- [x] Commit `DESIGN.md` (and `.stitch.json`) through a PR
- [x] Stitch CLI installed and authenticated; Stitch agent skill installed in `.claude/skills/stitch` (git-ignored)
- [ ] Stitch Loop workspace: deferred until the Next.js app has a dev server to capture (create workspace then; confirm before binding or uploading code)
- [x] Stitch access for the coding agent: via the Stitch CLI and skill (the skill says not to use the MCP server), so no MCP setup needed
- [x] `DESIGN.md` is the source of truth for tokens; Stitch screens are reference only; change requests update `DESIGN.md` first (rule in `CLAUDE.md`; `tests/design-tokens.test.ts` fails if the CSS colours or radii drift from `DESIGN.md`)
- [x] Use shadcn/ui configured from the `DESIGN.md` tokens (Radix base; Inter and JetBrains Mono via `next/font`; button, badge, input, textarea, card and label themed from the tokens; no dark mode)

### Screens

Thin pass first: tokens, typography and the three core screens (public board, idea detail, redeem/save-link). Design the rest just before each is built.

- [x] Public board page (idea list, sort, filter by status/tag, search) — Stitch screen `504be753664243cf873cfd26497bcdff` (corrected version; the original `ff29f6b9d83b4802b8bcd1d7849838c6` is superseded)
- [x] Idea detail page (description, votes, comments, status badge, tags) — Stitch screen `7be6abe824164eb2982f44eeb4dce3ab`
- [x] Submit idea form/modal — Stitch screen `cd79c35249f64e6faaf2f81b7e7a992d`
- [x] Roadmap view (columns: planned / in progress / shipped) — Stitch screen `15c97972d8fa48b8bb4ec3ee26dc03ac`
- [x] Create-team page + "save your owner link" state — Stitch screens `984839590cb349379438475d44e213f6` (form) and `a3f2236179c8435586416a9e6d108703` (save link)
- [x] Link redeem page ("Continue" button, display name for invites) — Stitch screen `c859b61108f64a1db7d6d6b142a1406b`
- [x] Team dashboard (all boards, moderation queue) — Stitch screen `6963416599ed459092b933def5652cdd`
- [x] Board settings (name, slug, visibility, tags, members, invite and share links) — Stitch screen `1a28fec14a5940728894203bd9cffcf4`
- [x] Delete team and delete board: danger zone, type-to-confirm dialogs, "Leave team" and the post-delete page (Stitch screens):
  - Board settings with danger zone `5575fc7941f04a6cb7b82dc563a80ed8` (supersedes `1a28fec1…`)
  - Delete board dialog, nothing typed, button disabled `9a4c24a62cc04ccca0248b03b62675f8`
  - Team settings (owner link, leave team, danger zone) `a4a2f569db3f429da37a650c0bc67677`
  - Delete team dialog, text typed, button enabled `9b1e780952204b7398a74c32f4f72e4e`
  - Team deleted page `803563132bba4b80958cd98ffbdacac4`
  - Known quirks: the delete-team dialog's background shows "Leave team" enabled and bell and help icons (the owner cannot leave while sole owner, and there are no notifications); Stitch's design system copy predates the danger components in `DESIGN.md`

The first versions of the submit, create-team, join, dashboard and settings screens (`ccd16f0a…`, `93f873fc…`, `d926894d…`, `69f9265c…`, `794cc163…`) are superseded: they had off-spec copy (member emails, an "Under review" status, "workspace", an invented footer). Stitch sample text is illustrative only; the app uses `SPEC.md` and `CONTEXT.md` wording (Team, Member, Owner link; no emails; statuses open/planned/in progress/shipped/declined; sort top/newest).

- [x] Empty, loading and error states (the set that matters for the MVP; Stitch screen ids):
  - Board: loading `6e0c7d43dd924dde9c42079e8e4b36c2`, empty `8b938a370bc94206a672650670c216f2`, no search results `858d718b36d248ab9c07a3a7dcdedd42`
  - Idea detail: loading `38d9e06bc0f6438e93ad16b558f114bf`, no comments plus rate-limit error `44fcdec60d25435ea3e4f503efea5622`
  - Roadmap: empty `42ff71e0bd374dbdbfb09eef81d27652`
  - Dashboard: queue empty `3dae060ebd874154bc54130ab6e6fe08`, loading `599c73d1080943fabcb08d7b227defaf` (the first versions `97d201ff…` and `079d3119…` are superseded: they showed a "Queue hygiene" note that contradicts post-moderation)
  - Submit dialog rate-limited: `035fbcc8cc0e40769bf4cbab7a83e31f`
  - Pages: not found `f4548d133cb046fd9e076c81406e5ab6`, link not valid `1ea3493f8aac4bf59639cb09ebc1b363`, server error `606430143f464749a0e186cfa938f224`
  - Not designed (reuse the patterns above when built): roadmap and board-settings loading, empty tag and member lists in settings, and an error state for the save-link screen. The server-error page says "Your input was not lost"; confirm the app can keep that promise or reword it.

---

## Phase 2: Database & Core Backend

### Schema & Migrations

- [x] Implement schema for all tables above, following `docs/database-er-diagram.md`: check constraints, composite same-board foreign keys on `idea_tags`, `ON DELETE CASCADE` down the tree (team, board, idea, tag), indexes
- [x] Verify PGlite supports the generated `tsvector` column and GIN index before relying on them (tested in `tests/schema.test.ts` and `tests/data.test.ts`)
- [ ] Generate migrations; verify they apply cleanly on PGlite and on a real Postgres (Neon) (done: `drizzle/0001_*.sql` applies on PGlite; real Postgres runs in CI; still to verify: Neon)
- [x] Integration tests: cascade deletes (team, board, idea children), member soft-removal keeps attribution, link-shape and `actor_id` check constraints
- [x] Seed script (`npm run db:seed`): 1 team, 2 boards, sample ideas, votes, comments, tags

### Data Access Layer

- [x] Repository/service functions for boards, ideas, votes, comments, tags (`src/data/`)
- [x] Idea list queries: sort by top / newest, filter by status and tag, keyword search (Postgres full-text search with a GIN index, behind one data-access function; no extensions)
- [x] Vote count computed efficiently (no N+1 queries)

---

## Phase 3: Anonymous Participation (Visitors)

### Anonymous Identity

- [ ] Issue a signed, HTTP-only anonymous ID cookie on first visit
- [ ] Helper to read the anonymous ID in server actions / route handlers

### Submit Ideas

- [ ] Submit idea (title, description) with validation and length limits
- [ ] Optional display name for anonymous authors
- [ ] Rate limit submissions per anonymous ID and IP (counters in a Postgres `rate_limits` table via `checkRateLimit(key, limit, window)`; also used for team creation per IP)
- [ ] Show similar existing ideas while typing the title (duplicate hint): same full-text query on the title only, top 3, debounced 300 ms, rate limited

### Upvote

- [ ] Toggle upvote (one vote per anonymous ID per idea, enforced by DB unique constraint)
- [ ] Optimistic UI update for votes
- [ ] Rate limit voting per IP

### Comments

- [ ] Add comment on an idea (anonymous or team member)
- [ ] Team replies are visually labelled
- [ ] Basic spam protection (rate limit, max length, honeypot field)

---

## Phase 4: Team Authentication & Management

### Secret-Link Auth

- [ ] Store only hashed link tokens; links are never logged; send `Referrer-Policy: no-referrer` on redeem pages
- [ ] Link opens a "Continue" page; the token is consumed on the button's POST (chat apps pre-fetch links)
- [ ] Redeem creates a database session (30 days, non-sliding) and redirects to the dashboard
- [ ] Logout and session expiry; removing a member ends their sessions immediately
- [ ] Reserved slugs (`login`, `api`, `dashboard`, ...) cannot be used for teams or boards

### Teams & Members

- [ ] Create team and first board (anyone, rate limited per IP); show the owner link once
- [ ] Owner generates member invite links (7-day expiry, multi-use, revocable); redeeming asks for a display name
- [ ] Owner can generate a replacement owner link while signed in; a lost owner link with no signed-in session means a lost team (documented limitation)
- [ ] Owner removes members (soft removal: `removed_at`, sessions ended, history keeps their name); the last owner can never be removed; a member can leave the team, and the last owner leaves by deleting the team
- [ ] Owner deletes the team: type the slug to confirm, permanent cascade, all links and sessions stop working, slug freed immediately
- [ ] Authorisation helper: `requireRole(team, "owner" | "member")` used by all protected actions

### Boards

- [ ] Create/edit boards under a team (unique slug per team), with visibility public or private
- [ ] Private boards: owner generates and rotates a board share link; visitors without it get a 404
- [ ] Owner deletes a board: type the board name to confirm, permanent cascade, URL returns not found; a team may have zero boards
- [ ] Public URL structure: `/{team-slug}/{board-slug}`

---

## Phase 5: Roadmap & Moderation (Team Features)

### Status Management

- [ ] Idea statuses: `open` (default for new ideas), `planned`, `in_progress`, `shipped`, `declined` (visible on board, not on roadmap); any transition allowed
- [ ] Owner/members can change status from idea detail and dashboard
- [ ] Record status change history (who, when, from → to)
- [ ] Roadmap view grouped by status

### Tags

- [ ] Owner/members create, rename, recolour and delete tags per board
- [ ] Assign/remove tags on ideas
- [ ] Filter public board by tag

### Moderation

- [ ] Hide/unhide an idea (hidden ideas are not visible publicly)
- [ ] Hide/unhide a comment (uses `comments.hidden`)
- [ ] Moderation queue on dashboard (newest unreviewed ideas)

---

## Phase 6: Polish & Quality

### UX

- [ ] Desktop layout check (1024px and wider); mobile and tablet are out of MVP scope
- [ ] Accessibility pass (keyboard navigation, labels, contrast)
- [ ] SEO basics for public board pages (titles, meta, Open Graph)

### Testing

- [ ] Test-first for security-sensitive logic (links, sessions, roles, rate limits, votes); tests after code for UI
- [ ] Unit tests: vote uniqueness, status transitions, role checks
- [ ] Integration tests for server actions against in-memory PGlite (the bulk of the suite)
- [ ] Run the same integration tests against real Postgres in CI (Postgres service or Neon branch)
- [ ] E2E (Playwright): submit idea → upvote → team owner link login → change status → visible on roadmap
- [ ] E2E: private board access via share link; member invite link join
- [x] Fresh-context review subagent on every PR (`qa-engineer`, `.claude/agents/qa-engineer.md`: reviews the diff against `SPEC.md` and `CONTEXT.md`, runs the checks, reports findings back); blocking findings must be fixed or explicitly dismissed by you in the PR
- [ ] Definition of done (write into `AGENTS.md`): green CI (lint, typecheck, unit + integration), E2E run on the PR, review subagent report addressed

---

## Phase 7: Deployment & Operations

### Vercel + Neon

- [ ] Create Neon project and connect via Vercel integration
- [ ] Configure env vars for Preview and Production (DB URL, session secret)
- [ ] Run migrations in a GitHub Actions step before the Vercel deploy; a failed migration fails the release
- [ ] Preview deployments per PR, each with its own Neon branch (Vercel–Neon integration) with migrations applied
- [ ] Merge to `main` creates a production deployment that is promoted by hand (human gate)
- [ ] Seed a demo team in production once with a script; print its owner link once, keep it in your own notes, never re-seed
- [ ] Migrations are backwards-compatible (add before remove) so a Vercel instant rollback never needs a database restore

### Production Readiness

- [ ] Error monitoring and basic logging
- [ ] Verify rate limits work behind Vercel's proxy (use the correct client IP header)
- [ ] Backup/restore approach for Neon documented (point-in-time restore steps; confirm the plan's retention window)
- [ ] README with setup, scripts, architecture and deploy instructions

---

## Phase 8: Maintenance (Change-Request Practice)

- [ ] Change request 1: "My activity" page showing status changes on ideas the visitor submitted or voted on (replaces email notification, which needs email)
- [ ] Change request 2: add idea sorting by "trending" (recent votes)
- [ ] Practise the full loop for each: spec update → design tweak → implement → test → deploy
- [ ] Write a short retrospective on what the agent did well and where it needed guidance

---

## Out of Scope (MVP)

- Image/file attachments
- Social/OAuth sign-in
- Custom domains per board
- Billing/plans
- Real-time updates (websockets)
- Mobile and tablet layouts (desktop only for the MVP)
- Merging duplicate ideas (team members can only hide duplicates)
- Email of any kind (sign-in, invites, notifications), passwords, user accounts
- Visitors editing or deleting their own ideas/comments
- Account/team recovery and undoing a deletion (deleting a team or board is allowed and permanent)

## Known Limitations

- Votes are tied to a cookie; clearing cookies allows revoting. Per-IP rate limits are only a speed bump.
- Whoever holds a link has its access until it is revoked or rotated.

## Open Questions

- (none yet)
