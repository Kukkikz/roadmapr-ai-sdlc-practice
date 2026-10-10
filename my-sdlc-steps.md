# My SDLC steps with an AI coding agent

Project: **Roadmapr**, a multi-tenant feedback and roadmap board, built as practice for the AI-coding-agent SDLC.
Period: 2026-10-08 to 2026-10-10. Sources: git history (PRs #1–#14), `PLAN.md`, `CLAUDE.md`, session transcripts.

## 1. Plan and specify

- Wrote a shared vocabulary in `CONTEXT.md` so code, tests, UI copy and commits use the same terms.
- Wrote user stories with acceptance criteria in `SPEC.md`. Every change maps to a story.
- Wrote a phased task list in `PLAN.md` and later re-sequenced it around dependencies (#7), filling gaps found in the spec.
- Recorded decisions as ADRs in `docs/adr/` (for example, PGlite as local Postgres everywhere). The agent may not reverse one without asking.

## 2. Give the agent standing instructions

- `CLAUDE.md` holds the stack, commands, conventions, workflow, definition of done and an "ask before" list. These cover dependencies, non-additive schema changes, auth and link handling, deploys, and anything that sends data outside the repo.
- `AGENTS.md` tells the agent to read the bundled Next.js docs, because this Next.js version is newer than the model knows.
- `.claude/agents/qa-engineer.md` defines a reviewer subagent. It became a required step in the workflow (#6).

## 3. Design

- Defined brand tokens in `DESIGN.md` as the source of truth for UI styling (#2).
- Used Stitch (CLI plus agent skill) for reference screens, including the empty, loading, error and delete states (#4).
- Themed shadcn/ui from the `DESIGN.md` tokens. A test fails if the CSS colours or radii drift from `DESIGN.md`.
- Rule: change requests update `DESIGN.md` first, and Stitch screens are reference only.

## 4. Scaffold and set up infrastructure

- Scaffolded Next.js, TypeScript, Drizzle with PGlite, Vitest, Playwright, ESLint, Prettier and CI (#1).
- Added zod env validation and `.env.example`.
- Created the GitHub repo and protected `main`: it needs a PR and the three CI checks (lint/typecheck/unit, real-Postgres integration, Playwright e2e). The rules apply to admins and allow no force-push.

## 5. Build, one small PR per task

Each task followed the same loop:

1. Pick a `PLAN.md` task and its user story, and restate the acceptance criteria.
2. Write tests first for security-sensitive logic (identity, rate limits, votes).
3. Implement the smallest change that meets the criteria.
4. Run lint, typecheck and tests, then have the `qa-engineer` subagent review the diff. Fix its findings and have it re-check.
5. Update `SPEC.md`, `CONTEXT.md`, `DESIGN.md` and the ER diagram if behaviour changed.
6. Branch, open a PR, wait for CI, then merge with my approval.

| PR | Work |
|----|------|
| #5 | Phase 2: schema, migration, data-access layer, seed |
| #8 | Phase 3a: public read pages (board, idea, roadmap) |
| #9 | Phase 3 PR 1: anonymous identity and rate limiter |
| #10 | Phase 3 PR 2: submit idea and duplicate hint |
| #11 | Phase 3 PR 3: upvote toggle with optimistic UI |
| #12 | Phase 3 PR 4: visitor comments |
| #13 | `npm run db:reset` |
| #14 | Neon smoke-test record, longer timeout for slow vote tests |

## 6. Test and verify

- Unit and integration tests run on in-memory PGlite (`npm test`).
- The same tests run against real Postgres (`npm run test:pg`).
- Playwright e2e runs on a seeded PGlite and its own dev server.
- Ran a manual Neon smoke test (2026-10-10): migrate, seed, pages, search, private-board 404, submit, duplicate hint, vote, comment, rate limit, and 20 parallel voters. `test:pg` against Neon passed 160 of 161. The one failure is a design-token test affected by Windows CRLF line endings.

## 7. Release and operate

- CI on GitHub Actions with three required checks.
- Production target is Vercel plus Neon Postgres. The Neon HTTP driver has been smoke-tested. The agent may not deploy or promote without my say-so.
- Added `npm run db:reset` for a local clean slate. It refuses to run against `DATABASE_URL`.

## 8. Guardrails I set for the agent

- No dependencies, auth or link changes, non-additive schema changes, deploys or Stitch re-uploads without asking.
- Never merge or push to `main` without my approval.
- Removal vs deletion rules, link tokens stored as hashes only, and no IP logging beyond the rate-limit key.
- The definition of done requires green checks, spec-covered acceptance criteria, a reviewed diff and docs that match the code.

## 9. Where I am now

Phases 0–3 are complete (PRs #1–#14 merged). Next is Phase 4 (secret-link auth, sessions, `requireRole`, teams, members, boards), then Phase 5 (status, tags, moderation) and Phase 6 (polish). Open items: the CRLF design-token test, and creating the Stitch Loop workspace now that the pages exist.
