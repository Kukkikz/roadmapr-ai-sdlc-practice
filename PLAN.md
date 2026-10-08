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

## Data Model (draft)

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

`actor_id` is `anon:<cookie-id>` or `member:<member-id>`. Owner links are bound to the owner's `member_id` and can start a session on any device; member invite links create a new member when redeemed; board share links grant a visitor access to one private board (recorded in the visitor's signed cookie). Statuses: open, planned, in_progress, shipped, declined (plain text + check constraint, no native enum).

---

## Phase 0: Planning & Setup

### Scope & Spec

- [x] Confirm MVP scope and out-of-scope list (see bottom of this file)
- [x] Write user stories with acceptance criteria in `SPEC.md`
- [x] Create `AGENTS.md` / `CLAUDE.md` with project conventions, commands and definition of done

### Project Scaffolding

- [x] Initialise Next.js + TypeScript + ESLint + Prettier (Vitest and Playwright smoke tests included)
- [ ] Set up Drizzle with PGlite for local dev (done: PGlite migrations and tests pass; still to verify: Neon driver and `test:pg` against a real Postgres)
- [x] Add `.env.example` and env validation (zod)
- [ ] Set up GitHub repo, branch protection, and CI skeleton (workflow written in `.github/workflows/ci.yml` but not yet run; repo, remote and branch protection still to do)

---

## Phase 1: Design (Stitch)

### Design System

- [ ] Define brand tone, colours, typography in Stitch
- [ ] Export `DESIGN.md` and commit it
- [x] Stitch CLI installed and authenticated; Stitch agent skill installed in `.agents/skills/stitch`
- [ ] Stitch Loop workspace: deferred until the Next.js app has a dev server to capture (create workspace then; confirm before binding or uploading code)
- [ ] Connect Stitch MCP to the coding agent (fallback if unavailable: agent builds from `DESIGN.md` alone)
- [ ] `DESIGN.md` is the source of truth for tokens; Stitch screens are reference only; change requests update `DESIGN.md` first
- [ ] Use shadcn/ui configured from the `DESIGN.md` tokens

### Screens

Thin pass first: tokens, typography and the three core screens (public board, idea detail, redeem/save-link). Design the rest just before each is built.

- [ ] Public board page (idea list, sort, filter by status/tag, search)
- [ ] Idea detail page (description, votes, comments, status badge, tags)
- [ ] Submit idea form/modal
- [ ] Roadmap view (columns: planned / in progress / shipped)
- [ ] Create-team page + "save your owner link" state
- [ ] Link redeem page ("Continue" button, display name for invites)
- [ ] Team dashboard (all boards, moderation queue)
- [ ] Board settings (name, slug, visibility, tags, members, invite and share links)
- [ ] Empty, loading and error states for every screen
- [ ] Mobile layouts for the public board and idea detail

---

## Phase 2: Database & Core Backend

### Schema & Migrations

- [ ] Implement schema for all tables above
- [ ] Generate migrations; verify they apply cleanly on PGlite and on a real Postgres (Neon)
- [ ] Seed script: 1 team, 2 boards, sample ideas, votes, comments, tags

### Data Access Layer

- [ ] Repository/service functions for boards, ideas, votes, comments, tags
- [ ] Idea list queries: sort by top / newest, filter by status and tag, keyword search (Postgres full-text search with a GIN index, behind one data-access function; no extensions)
- [ ] Vote count computed efficiently (no N+1 queries)

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
- [ ] Owner removes members; the last owner can never be removed
- [ ] Authorisation helper: `requireRole(team, "owner" | "member")` used by all protected actions

### Boards

- [ ] Create/edit boards under a team (unique slug per team), with visibility public or private
- [ ] Private boards: owner generates and rotates a board share link; visitors without it get a 404
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

- [ ] Responsive check on mobile / tablet / desktop
- [ ] Accessibility pass (keyboard navigation, labels, contrast)
- [ ] SEO basics for public board pages (titles, meta, Open Graph)

### Testing

- [ ] Test-first for security-sensitive logic (links, sessions, roles, rate limits, votes); tests after code for UI
- [ ] Unit tests: vote uniqueness, status transitions, role checks
- [ ] Integration tests for server actions against in-memory PGlite (the bulk of the suite)
- [ ] Run the same integration tests against real Postgres in CI (Postgres service or Neon branch)
- [ ] E2E (Playwright): submit idea → upvote → team owner link login → change status → visible on roadmap
- [ ] E2E: private board access via share link; member invite link join
- [ ] Fresh-context review subagent on every PR, checking the diff against `SPEC.md` and `CONTEXT.md`; blocking findings must be fixed or explicitly dismissed by you in the PR
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
- Merging duplicate ideas (team members can only hide duplicates)
- Email of any kind (sign-in, invites, notifications), passwords, user accounts
- Visitors editing or deleting their own ideas/comments
- Account/team recovery and team deletion

## Known Limitations

- Votes are tied to a cookie; clearing cookies allows revoting. Per-IP rate limits are only a speed bump.
- Whoever holds a link has its access until it is revoked or rotated.

## Open Questions

- (none yet)
