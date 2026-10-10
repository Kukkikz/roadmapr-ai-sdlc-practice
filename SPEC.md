# Roadmapr — Specification

Behavioural spec for the MVP. `PLAN.md` says what to build in which order; `CONTEXT.md` defines the terms used here (Team, Board, Idea, Visitor, Member, Owner, Actor, Owner link, Member invite link, Board share link). Acceptance criteria (AC) are written so each can become a test.

## Global rules

- **G1 Identity.** Visitors are identified by a signed, HTTP-only cookie (`anon:<id>`). Members by a database session (`member:<id>`). A signed-in Member always acts as `member:`, never as their anonymous cookie.
- **G2 Visibility.** A hidden Idea or Comment is never returned to Visitors. Members see hidden items marked as hidden. Writes to a hidden Idea (vote, comment) respond 404 for Visitors, same as reads.
- **G3 Private boards.** For anyone without a valid Board share link or Member session for that Team, a Private board responds exactly like a board that does not exist (404).
- **G4 Links.** Link tokens are stored hashed only, never logged. Opening a link shows a "Continue" page; the token is consumed by the POST. Redeem pages send `Referrer-Policy: no-referrer`.
- **G5 Rate limits.** Limited actions return a clear "slow down" error, never a crash. Counters live in the `rate_limits` table. Limits use fixed windows (a burst across a window boundary can pass up to twice the limit) and are in the table below; every key listed for an action must pass. The client IP is read in one place (`getClientIp()`) and is used for rate limiting only.
- **G6 Slugs.** Team and board slugs are lowercase, URL-safe, unique (team slug globally, board slug per team), and cannot be a reserved word (`login`, `api`, `dashboard`, `join`, ...).
- **G7 Statuses.** `open` (default), `planned`, `in_progress`, `shipped`, `declined`. Any transition is allowed; every change is recorded.
- **G8 Removal and deletion.** Members are _removed_ softly (row kept, `removed_at` set, history stays attributed). Teams and Boards are _deleted_ for good, cascading to everything beneath them, after the Owner types a confirmation. Ideas and Comments are never deleted, only hidden (a Tag's deletion removes it from Ideas).

### Rate limits (G5)

| Action        | Key           | Limit             |
| ------------- | ------------- | ----------------- |
| Submit Idea   | cookie and IP | 5 per 10 minutes  |
| Comment       | cookie and IP | 10 per 10 minutes |
| Vote          | IP            | 60 per minute     |
| Similar Ideas | IP            | 30 per minute     |
| Create Team   | IP            | 3 per hour        |
| Redeem link   | IP            | 10 per 10 minutes |

Every attempt to redeem a link (the "Continue" POST) counts, valid or not, so guessing tokens is throttled.

## Epic 1 — Visitors browse boards

**US-1.1** As a Visitor, I can open a public board and see its Ideas.

- AC: Lists non-hidden Ideas with title, status badge, tags, vote count, comment count.
- AC: Sort by top (votes) or newest; default is top.
- AC: Filter by status and by tag; filters combine.
- AC: Keyword search matches title and description using full-text search.
- AC: Empty board, no-results and error states are shown.

**US-1.2** As a Visitor, I can open an Idea and read it.

- AC: Shows title, description, author name (or "Anonymous"), status badge, tags, votes, and visible Comments oldest-first.
- AC: Comments by Members are labelled as the team.
- AC: A hidden Idea returns 404 to Visitors.

**US-1.3** As a Visitor, I can view the roadmap.

- AC: Three columns: planned, in progress, shipped. `open` and `declined` Ideas do not appear.
- AC: Each card shows title, vote count and tags and links to the Idea.

## Epic 2 — Visitors participate

**US-2.1** As a Visitor, I can submit an Idea without signing in.

- AC: Title required (max 120 chars), description optional (max 2000), optional display name (max 40).
- AC: New Idea has status `open`, is visible immediately, and is authored by my Actor.
- AC: A filled honeypot field silently discards the submission.
- AC: Exceeding the submission rate limit (per cookie and per IP) shows a "slow down" error and creates nothing.
- AC: While typing the title, up to 3 similar Ideas are suggested (debounced 300 ms, title-only full-text query, rate limited).

**US-2.2** As a Visitor, I can upvote an Idea and take the vote back.

- AC: One vote per Actor per Idea, enforced by a database unique constraint.
- AC: Voting again removes the vote (toggle). The count updates optimistically and reconciles with the server.
- AC: Voting is rate limited per IP.
- AC: Votes are allowed on Ideas in every status.

**US-2.3** As a Visitor, I can comment on an Idea.

- AC: Body required (max 1000 chars), optional display name, honeypot and rate limit as in US-2.1.
- AC: Comments are allowed on Ideas in every status.

**US-2.4** As a Visitor, I can join a Private board with its share link.

- AC: Opening a valid link shows a "Continue" page; continuing stores access to that board in my signed cookie and redirects to the board.
- AC: A revoked, rotated or unknown token shows a generic "link not valid" page.
- AC: With access I participate exactly as on a public board (US-2.1 to 2.3).

**Out of scope:** Visitors cannot edit or delete their Ideas, Comments or Votes-after-cookie-loss.

## Epic 3 — Teams, Members, access

**US-3.1** As anyone, I can create a Team.

- AC: Form takes team name, team slug and first board name; creates the Team, the Owner Member (display name asked) and the first Board.
- AC: The Owner link is shown once with a "save this link" warning and a copy button; only its hash is stored.
- AC: Team creation is rate limited per IP.

**US-3.2** As an Owner, I can sign in on any device with my Owner link.

- AC: Opening the link shows "Continue"; continuing creates a session (30 days, non-sliding) and redirects to the dashboard. The link stays valid until replaced.
- AC: Owner links open at `/login/<token>` and Member invite links at `/join/<token>`. A link opened at the other path, an unknown, expired or revoked link, and a link whose Member was removed all show "link not valid". Only the POST consumes a link; opening it never does.
- AC: The session cookie is HTTP-only and holds a random token; only its hash is stored. Every redeem issues a new session token. Redeeming is rate limited per IP (G5).
- AC: While signed in, I can generate a replacement Owner link, which invalidates the old one.

**US-3.3** As an Owner, I can invite Members with a Member invite link.

- AC: Generate a link (expires in 7 days, multi-use) and revoke it at any time.
- AC: Redeeming asks for a display name, creates a Member with role `member`, starts a session and redirects to the dashboard.
- AC: Expired and revoked links show "link not valid".

**US-3.4** As an Owner, I can remove a Member.

- AC: Removal is soft: the Member row is kept with `removed_at` set, so the Member's past Ideas and Comments keep their display name and team label.
- AC: The removed Member's sessions end immediately, and they can no longer act on the Team.
- AC: The last Owner cannot be removed.

**US-3.7** As a Member, I can leave the Team.

- AC: Leaving is the same soft removal as US-3.4, applied to myself, and ends my sessions.
- AC: The last Owner cannot leave; they delete the Team instead (US-3.8).

**US-3.8** As an Owner, I can delete the Team.

- AC: I must type the Team slug to confirm, and the screen states what will be lost (all Boards, Ideas, Votes, Comments, Tags, Members and links).
- AC: Deletion is permanent and cascades to everything under the Team; there is no undo.
- AC: Every Owner link, Member invite link, Board share link and session of the Team stops working; Visitors get the generic "not found" page.
- AC: The Team slug is freed immediately and can be claimed by a new Team.

**US-3.5** As a Member, I can sign out.

- AC: The session is deleted server-side and the cookie cleared.

**US-3.6** Authorisation.

- AC: Every protected action calls `requireRole(team, "owner" | "member")`.
- AC: A Member from Team A can never act on Team B. An Owner-only action by a plain Member is rejected.
- AC: Owner-only actions include removing Members, generating and revoking links, editing Boards and deleting a Board or the Team.

## Epic 4 — Boards

**US-4.1** As an Owner, I can create and edit Boards.

- AC: Name, slug, description, visibility (public or private).
- AC: Public URL is `/{team-slug}/{board-slug}`.

**US-4.2** As an Owner, I can manage a Private board's share link.

- AC: Generate and rotate the Board share link; rotating invalidates the old one and access previously granted by it.
- AC: A Visitor's access is stored in their signed cookie as the Board and the share link it came from. It holds only while that link exists and is not revoked, so rotating the link ends previously granted access. Ideas, Votes and Comments the Visitor wrote earlier stay.
- AC: Switching visibility changes who can see content; nothing is deleted.

**US-4.3** As an Owner, I can delete a Board.

- AC: I must type the Board name to confirm, and the screen states what will be lost (its Ideas, Votes, Comments, Tags and share link).
- AC: Deletion is permanent and cascades to the Board's Ideas and everything under them, its Tags and its Board share link; there is no undo.
- AC: The Board URL returns the generic "not found" page, and its slug is freed for the Team.
- AC: A Team may have zero Boards; the dashboard then offers "Create board".

## Epic 5 — Roadmap and moderation (Members)

**US-5.1** As a Member, I can change an Idea's status.

- AC: From the Idea page or dashboard; any status to any other.
- AC: Each change creates an `idea_status_events` row (who, when, from, to).

**US-5.2** As a Member, I can manage tags.

- AC: Create, rename, recolour and delete tags per Board; deleting a tag removes it from Ideas.
- AC: Assign and remove tags on Ideas.

**US-5.3** As a Member, I can hide and unhide Ideas and Comments.

- AC: Hidden items disappear for Visitors (G2) and show as hidden to Members.

**US-5.4** As a Member, I can reply as the team.

- AC: My Comments are labelled with the team and my display name.

**US-5.5** As a Member, I see a moderation queue.

- AC: The dashboard lists Ideas with `reviewed_at` null, newest first, across the Team's Boards.
- AC: Opening, tagging, changing status of or hiding an Idea sets `reviewed_at`.

## Non-functional requirements

- **NF1 Accessibility:** all screens keyboard-navigable, labelled form fields, WCAG AA contrast, visible focus.
- **NF2 Desktop only:** screens are designed and tested for viewports of 1024 px and wider. Mobile and tablet layouts are out of MVP scope.
- **NF3 Performance:** Idea list uses no N+1 queries (vote and comment counts aggregated in the query).
- **NF4 SEO:** public board and Idea pages have title, description and Open Graph tags; Private boards are `noindex`.
- **NF5 Parity:** the same migrations and integration tests pass on PGlite and on real Postgres.
- **NF6 Privacy:** IP addresses are used for rate limiting only and are not stored with Ideas, Votes or Comments.

## Known limitations (accepted)

- Votes are tied to a cookie; clearing cookies allows revoting.
- Whoever holds a link has its access until it is revoked or rotated.
- A lost Owner link with no signed-in session means a lost Team.
- Deleting a Team or Board is permanent. A freed Team slug can be claimed by someone else, so old URLs may later open a different Team.

## Out of scope

Attachments, OAuth, custom domains, billing, real-time updates, mobile and tablet layouts, merging Ideas, email of any kind, passwords or accounts, visitor edit/delete, team recovery and undo of deletions.
