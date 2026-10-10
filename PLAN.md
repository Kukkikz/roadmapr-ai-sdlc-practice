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

## How to read this plan

- A **task** is a cluster of checkboxes that ships and tests on its own, in one PR (not one PR per checkbox). Phase 3 lists its PRs in order.
- Each checkbox is tagged with the `SPEC.md` story or rule it implements, e.g. `[US-2.1]`, `[G5]`, `[NF4]`. "(technical)" marks plumbing with no story of its own. The story index at the bottom maps stories back to phases.
- Phases 3a, 3, 4 and 5 are vertical slices: each cluster ships its logic, its screens (Stitch ids from Phase 1) and one Playwright spec. Phase 6 only joins those specs into cross-phase journeys.
- Dependencies run top to bottom: 3a (pages) before 3 (participation, mounted on those pages) before 4 (sessions, teams, private boards) before 5 (team features). Phase 3 is anonymous-only and reaches private boards and Members only through the `canAccessBoard` and actor-helper seams that Phase 4 fills in.

---

## Phase 0: Planning & Setup

### Scope & Spec

- [x] Confirm MVP scope and out-of-scope list (see bottom of this file)
- [x] Write user stories with acceptance criteria in `SPEC.md`
- [x] Create `AGENTS.md` / `CLAUDE.md` with project conventions, commands and definition of done

### Project Scaffolding

- [x] Initialise Next.js + TypeScript + ESLint + Prettier (Vitest and Playwright smoke tests included)
- [x] Set up Drizzle with PGlite for local dev (PGlite migrations and tests pass; the same tests pass on real Postgres in CI and on Neon; the app runs on Neon's HTTP driver, smoke-tested 2026-10-10: migrate, seed, pages, submit, vote, comment, rate limiter)
- [x] Add `.env.example` and env validation (zod)
- [x] Set up GitHub repo, branch protection, and CI skeleton (public repo `Kukkikz/roadmapr-ai-sdlc-practice`; `main` requires a PR and the three CI checks, no force-push, linear history, applies to admins)

---

## Phase 1: Design (Stitch)

### Design System

- [x] Define brand tone, colours, typography in Stitch (`DESIGN.md` uploaded; Stitch project "Roadmapr" id `7208899953600583130`, the only design system is `5046df3c154341a381a0748a09305b70`; the duplicate `14df3a9e…` was deleted in the Stitch UI. Re-uploading `DESIGN.md` creates a new design system each time, and the CLI cannot delete one)
- [x] Commit `DESIGN.md` (and `.stitch.json`) through a PR
- [x] Stitch CLI installed and authenticated; Stitch agent skill installed in `.claude/skills/stitch` (git-ignored)
- [ ] Stitch Loop workspace: deferred until the Next.js app has pages to capture, i.e. once Phase 3a ships (create workspace then; confirm before binding or uploading code)
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
  - Not designed (reuse the patterns above when built): roadmap and board-settings loading, empty tag and member lists in settings, and an error state for the save-link screen. The server-error page says "Your input was not lost"; decided: reword it to "Something went wrong. Try again." (built in Phase 3a).

---

## Phase 2: Database & Core Backend

### Schema & Migrations

- [x] Implement schema for all tables above, following `docs/database-er-diagram.md`: check constraints, composite same-board foreign keys on `idea_tags`, `ON DELETE CASCADE` down the tree (team, board, idea, tag), indexes
- [x] Verify PGlite supports the generated `tsvector` column and GIN index before relying on them (tested in `tests/schema.test.ts` and `tests/data.test.ts`)
- [x] Generate migrations; verify they apply cleanly on PGlite and on a real Postgres (Neon) (`drizzle/0000_*.sql` and `0001_*.sql` apply on PGlite, on real Postgres in CI, and on Neon over the HTTP driver, 2026-10-10)
- [x] Integration tests: cascade deletes (team, board, idea children), member soft-removal keeps attribution, link-shape and `actor_id` check constraints
- [x] Seed script (`npm run db:seed`): 1 team, 2 boards, sample ideas, votes, comments, tags

### Data Access Layer

- [x] Repository/service functions for boards, ideas, votes, comments, tags (`src/data/`)
- [x] Idea list queries: sort by top / newest, filter by status and tag, keyword search (Postgres full-text search with a GIN index, behind one data-access function; no extensions)
- [x] Vote count computed efficiently (no N+1 queries)

---

## Phase 3a: Public Read Pages (Visitors)

Phase 2 built the queries and Phase 1 designed the screens; nothing built the pages. This phase does, so Phase 3 has somewhere to mount its forms and buttons. Public boards only: `canAccessBoard` (see Phase 3) returns true for them, and Phase 4 adds the private-board check.

- [x] Routing and the generic not-found page: `/{team-slug}/{board-slug}` resolves a Board by slugs; unknown Teams, Boards and hidden Ideas all render the same not-found page [G2, G3, US-1.2]. Stitch screen `f4548d13…`
- [x] Board page: Idea list with status badge, tags, vote count and comment count; sort top / newest; filter by status and tag; keyword search [US-1.1]. Stitch screen `504be753…`
- [x] Board states: loading, empty board and no search results [US-1.1]. Stitch screens `6e0c7d43…`, `8b938a37…`, `858d718b…`
- [x] Idea detail page: title, description, author name or "Anonymous", status badge, tags, votes, visible Comments oldest-first [US-1.2]. Stitch screen `7be6abe8…`; loading state `38d9e06b…`
- [x] Roadmap page: planned / in progress / shipped columns; `open` and `declined` do not appear; each card links to its Idea [US-1.3]. Stitch screen `15c97972…`; empty state `42ff71e0…`
- [x] Server-error page, with the copy reworded to a promise the app can keep ("Something went wrong. Try again.") [US-1.1]. Stitch screen `60643014…`
- [x] Playwright spec: browse a seeded board, filter, search, open an Idea, view the roadmap [US-1.1, US-1.2, US-1.3]

---

## Phase 3: Anonymous Participation (Visitors)

Anonymous only. Member comments, the team label and the private-board share-link cookie arrive in Phase 4, once Member sessions exist. Every Phase 3 action calls `canAccessBoard(board, visitor)` first; for now it returns true for public boards and false for private ones, and Phase 4 implements the rest.

PRs, in order: (1) identity and rate limiter, (2) submit and duplicate hint, (3) vote, (4) comments. Each PR includes its Playwright spec.

### Identity and Rate Limiter (PR 1)

- [x] Issue a signed, HTTP-only anonymous ID cookie [G1] (technical). Next.js only lets Server Actions and Route Handlers set cookies, so `getVisitor()` issues it on the Visitor's first action, not on first page view; `readVisitor()` is read-only for pages
- [x] Helper to read the anonymous ID in server actions / route handlers (`src/lib/visitor.ts`); the one place that later learns about `member:` [G1] (technical)
- [x] `getClientIp()`: the one place the client IP is read (`x-forwarded-for` aware); IPs are used for rate limiting only [G5, NF6] (technical)
- [x] `checkRateLimit(key, limit, window)` over the `rate_limits` table, atomic in one statement (no interactive transaction, so it works over Neon's HTTP driver); limits per the table in `SPEC.md` G5 [G5] (technical)
- [x] Neon smoke test (run after the PR merged, 2026-10-10, on an empty Neon Postgres 17 database): `db:migrate` and `db:seed` over the HTTP driver; the app on Neon with browser checks for the Idea list, full-text search, Private-board 404, submit, duplicate hint, vote on/off, comment, the 6th-submission refusal, and 20 parallel Visitors voting (all counted); no raw IPs in `rate_limits`; `test:pg` against Neon passes (160 of 161, the one failure is the Windows CRLF design-token test). Slow rate-limit tests got a 120 s timeout because of internet latency
- [x] Hidden-Idea write guard: `findIdeaForVisitor` returns null for a hidden Idea or a Board the Visitor cannot see, so votes and comments respond 404 for Visitors [G2, G3]; the vote and comment actions (PRs 3 and 4) must call it

### Submit Ideas (PR 2)

- [x] Submit idea (title, description) with validation and length limits [US-2.1]
- [x] Optional display name for anonymous authors [US-2.1]
- [x] Honeypot field silently discards the submission [US-2.1]
- [x] Rate limit submissions per anonymous ID and IP [US-2.1, G5]
- [x] Show similar existing ideas while typing the title (duplicate hint): full-text query on the title only (matches any shared word, unlike board search which needs all), top 3, debounced 300 ms, rate limited [US-2.1]
- [x] Submit dialog, with its rate-limited state [US-2.1, G5]. Stitch screens `cd79c352…`, `035fbcc8…`

### Upvote (PR 3)

- [x] Toggle upvote (one vote per anonymous ID per idea, enforced by DB unique constraint) [US-2.2]
- [x] Optimistic UI update for votes, reconciled with the server [US-2.2]
- [x] Rate limit voting per IP [US-2.2, G5]
- [x] Votes allowed on Ideas in every status [US-2.2]

### Comments (PR 4)

- [x] Add comment on an idea as a Visitor: body required, max 1000 characters, optional display name [US-2.3]
- [x] Basic spam protection: rate limit, max length, honeypot field [US-2.3, G5]
- [x] Comments allowed on Ideas in every status [US-2.3]
- [x] No-comments state and the rate-limit error [US-2.3, G5]. Stitch screen `44fcdec6…`

---

## Phase 4: Team Authentication & Management

Each cluster ships with its screens and one Playwright spec, so Phase 6 only has to join them into journeys. Reserved slugs come first, because team creation and board creation both depend on them.

### Secret-Link Auth

- [x] Reserved slugs (`login`, `api`, `dashboard`, `join`, ...) cannot be used for teams or boards [G6] (`slugSchema` in `src/lib/slugs.ts`; Team and Board creation must use it)
- [x] Store only hashed link tokens; links are never logged; send `Referrer-Policy: no-referrer` on redeem pages [G4] (SHA-256 of 256-bit tokens; the redeem pages also send `Cache-Control: no-store` and `noindex`; baseline `X-Frame-Options`, `nosniff` and HSTS on every route, CSP deferred)
- [x] Link opens a "Continue" page; the token is consumed on the button's POST (chat apps pre-fetch links) [G4, US-3.2]. Screens: redeem page `c859b611…`, link not valid `1ea3493f…`
- [x] Redeem creates a database session (30 days, non-sliding) and redirects to the dashboard [US-3.2] (`/login/<token>` and `/join/<token>`; redeem is rate limited per IP, 10 per 10 minutes; `/dashboard` is a placeholder until US-4.3)
- [x] Logout and session expiry [US-3.5] (`signOut` deletes the Session row then clears the cookie; expired Sessions are refused on lookup and purged at random on redeem; signing in again ends the browser's previous Session)
- [x] Authorisation helper: `requireRole(team, "owner" | "member")` used by all protected actions [US-3.6] (`src/lib/authz.ts`; throws `AuthorizationError`; `teamId` must come from server data, never a form field; every later protected action must call it first)
- [x] The Visitor actor helper learns `member:`: a signed-in Member acts as `member:<id>`, never as their anonymous cookie [G1] (`readVisitor`/`getVisitor` in `src/lib/visitor.ts`; a Member is issued no anonymous cookie and rate-limits under `member:<id>`)

### Teams & Members

- [ ] Create team and first board (anyone, rate limited per IP); show the owner link once [US-3.1, G5]. Screens: create-team `98483959…`, save-link `a3f22361…`
- [ ] Owner generates member invite links (7-day expiry, multi-use, revocable); redeeming asks for a display name [US-3.3]
- [ ] Owner can generate a replacement owner link while signed in; a lost owner link with no signed-in session means a lost team (documented limitation) [US-3.2]
- [ ] Owner removes members (soft removal: `removed_at`, sessions ended immediately, history keeps their name); the last owner can never be removed [US-3.4, G8]
- [ ] A member can leave the team; the last owner leaves by deleting the team [US-3.7]. Screen: team settings `a4a2f569…`
- [ ] Owner deletes the team: type the slug to confirm, permanent cascade, all links and sessions stop working, slug freed immediately [US-3.8, G8]. Screens: dialog `9b1e7809…`, team deleted `80356313…`
- [ ] Members comment as the team: Comments by a signed-in Member use `member:<id>` and are labelled with the team and display name [US-5.4]
- [ ] Team dashboard, boards part: list of Boards, "Create board" when there are none [US-4.3]. Stitch screen `69634165…`

### Boards

- [ ] Create/edit boards under a team (unique slug per team), with visibility public or private [US-4.1]. Screen: board settings `5575fc79…`
- [ ] Private boards: owner generates and rotates a board share link; visitors without it get a 404 [US-4.2, G3]
- [ ] `canAccessBoard` private-board check: a valid Member session for the Team, or a signed cookie holding `{boardId, linkId}` whose `access_links` row still exists and is not revoked, so rotating the link ends previously granted access [US-4.2, G3]
- [ ] Visitor joins a Private board with its share link ("Continue" page, then cookie, then redirect); revoked, rotated or unknown tokens show "link not valid" [US-2.4, G4]
- [ ] Owner deletes a board: type the board name to confirm, permanent cascade, URL returns not found; a team may have zero boards [US-4.3, G8]. Screen: dialog `9a4c24a6…`
- [ ] Public URL structure: `/{team-slug}/{board-slug}` (built in Phase 3a; Phase 4 adds the private-board case) [US-4.1]

---

## Phase 5: Roadmap & Moderation (Team Features)

Same rule as Phase 4: each cluster ships with its screens and a Playwright spec.

### Status Management

- [ ] Idea statuses: `open` (default for new ideas), `planned`, `in_progress`, `shipped`, `declined` (visible on board, not on roadmap); any transition allowed [G7]
- [ ] Owner/members can change status from idea detail and dashboard [US-5.1]
- [ ] Record status change history (who, when, from → to) [US-5.1]

### Tags

- [ ] Owner/members create, rename, recolour and delete tags per board [US-5.2]
- [ ] Assign/remove tags on ideas [US-5.2]

### Moderation

- [ ] Hide/unhide an idea (hidden ideas are not visible publicly) [US-5.3, G2]
- [ ] Hide/unhide a comment (uses `comments.hidden`) [US-5.3, G2]
- [ ] Moderation queue on dashboard (newest unreviewed ideas); opening, tagging, changing status of or hiding an Idea sets `reviewed_at` [US-5.5]. Stitch screens: dashboard `69634165…`, queue empty `3dae060e…`, loading `599c73d1…`

---

## Phase 6: Polish & Quality

### UX

- [ ] Desktop layout check (1024px and wider); mobile and tablet are out of MVP scope [NF2]
- [ ] Accessibility pass (keyboard navigation, labels, contrast) [NF1]
- [ ] SEO basics for public board pages (titles, meta, Open Graph); Private boards are `noindex` [NF4]

### Testing

Test-first for security-sensitive logic and per-slice Playwright specs happen inside Phases 3a to 5. This phase covers what spans phases.

- [ ] Unit tests: vote uniqueness, status transitions, role checks (fill gaps left by the phase PRs) [US-2.2, G7, US-3.6]
- [ ] Integration tests for server actions against in-memory PGlite (the bulk of the suite); audit for gaps against the story index below
- [ ] Run the same integration tests against real Postgres in CI (Postgres service or Neon branch) [NF5]
- [ ] E2E journey (Playwright), joining the per-phase specs: submit idea → upvote → team owner link login → change status → visible on roadmap
- [ ] E2E journey: private board access via share link; member invite link join
- [x] Fresh-context review subagent on every PR (`qa-engineer`, `.claude/agents/qa-engineer.md`: reviews the diff against `SPEC.md` and `CONTEXT.md`, runs the checks, reports findings back); blocking findings must be fixed or explicitly dismissed by you in the PR

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
- [ ] Verify rate limits work behind Vercel's proxy (`getClientIp()` from Phase 3 reads the correct client IP header)
- [ ] Backup/restore approach for Neon documented (point-in-time restore steps; confirm the plan's retention window)
- [ ] README with setup, scripts, architecture and deploy instructions

---

## Phase 8: Maintenance (Change-Request Practice)

- [ ] Change request 1: "My activity" page showing status changes on ideas the visitor submitted or voted on (replaces email notification, which needs email)
- [ ] Change request 2: add idea sorting by "trending" (recent votes)
- [ ] Practise the full loop for each: spec update → design tweak → implement → test → deploy
- [ ] Write a short retrospective on what the agent did well and where it needed guidance

---

## Story Index

| Story / rule                                         | Built in                                         |
| ---------------------------------------------------- | ------------------------------------------------ |
| US-1.1, US-1.2, US-1.3 (browse, read, roadmap)       | Phase 3a                                         |
| US-2.1 (submit)                                      | Phase 3 PR 2                                     |
| US-2.2 (vote)                                        | Phase 3 PR 3                                     |
| US-2.3 (comment as a Visitor)                        | Phase 3 PR 4                                     |
| US-2.4 (join a Private board)                        | Phase 4, Boards                                  |
| US-3.1 to US-3.8 (teams, links, sessions, roles)     | Phase 4                                          |
| US-4.1 to US-4.3 (boards, share link, delete)        | Phase 4, Boards                                  |
| US-5.1 to US-5.3, US-5.5 (status, tags, hide, queue) | Phase 5                                          |
| US-5.4 (reply as the team)                           | Phase 4, Teams & Members                         |
| G1 identity                                          | Phase 3 PR 1, extended in Phase 4                |
| G2 hidden items                                      | Phase 3a (reads), Phase 3 PR 1 (writes), Phase 5 |
| G3 private boards                                    | Phase 3a (404), Phase 4 (`canAccessBoard`)       |
| G4 links, G6 slugs                                   | Phase 4                                          |
| G5 rate limits                                       | Phase 3 PR 1, applied per action, Phase 4 (team) |
| G7 statuses, G8 removal and deletion                 | Phase 5, Phase 4                                 |
| NF1, NF2, NF4                                        | Phase 6                                          |
| NF3 (no N+1)                                         | Phase 2                                          |
| NF5 (parity)                                         | Phase 2, CI; Phase 3 PR 1 adds Neon              |
| NF6 (IP only for rate limits)                        | Phase 3 PR 1                                     |

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
- A Visitor's very first action issues their anonymous cookie in its response. If that response is lost, the action may still be recorded under an ID the browser never received, so a first vote can be orphaned (and a retry adds another).
- The Board page and each roadmap column show at most the top 50 Ideas; there is no paging yet.

## Open Questions

- (none yet)
