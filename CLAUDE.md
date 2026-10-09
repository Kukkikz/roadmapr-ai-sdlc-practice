# Roadmapr

Multi-tenant feedback and roadmap board. Practice project for the AI-coding-agent SDLC.

## Read first

- `CONTEXT.md` — domain vocabulary. Use these exact terms in code, tests, UI copy and commits.
- `SPEC.md` — behaviour and acceptance criteria. Every change maps to a user story.
- `PLAN.md` — phased task list. Work on one task at a time; tick it when done.
- `docs/adr/` — decisions already made. Do not reverse one without asking.
- `docs/database-er-diagram.md` — the data model: tables, constraints, cascade rules, indexes. Keep it in sync with `src/db/schema.ts`.
- [`AGENTS.md`](AGENTS.md) — Next.js agent rules. This Next.js version differs from what models know, so read the docs it points to before writing Next code. `next dev` maintains that file; do not edit it by hand.
- `DESIGN.md` — design tokens and component rules. It is the source of truth for UI styling. Stitch screens (project id in `.stitch.json`) are reference only; their sample copy is illustrative.

## Stack

Next.js App Router + TypeScript, Drizzle (single `pg-core` schema), PGlite locally and in tests, Neon Postgres in production, shadcn/ui, Vitest, Playwright, GitHub Actions, Vercel.

## Commands

Keep these names and update this section when they change.

- `npm run dev` — start the app; needs `SESSION_SECRET` in `.env.local` (see `.env.example`); uses file-backed PGlite in `.data/pglite` (or `PGLITE_DATA_DIR`) unless `DATABASE_URL` is set
- `npm run lint` / `npm run typecheck` / `npm run format:check` (`npm run format` fixes)
- `npm test` — unit + integration (in-memory PGlite)
- `npm run test:pg` — same tests against real Postgres; set `TEST_DATABASE_URL` (the database is wiped)
- `npm run test:e2e` — Playwright (builds a fresh seeded PGlite in `.data/e2e-pglite` via `scripts/e2e-setup.mts`, then starts its own dev server on port 3100)
- `npm run db:generate` — create a migration from `src/db/schema.ts`; `npm run db:migrate` — apply migrations (Neon if `DATABASE_URL`, else local PGlite)
- `npm run db:seed` — sample Team, Boards, Ideas, votes, Comments and Tags (Neon if `DATABASE_URL`, else local PGlite); run `db:migrate` first, on an empty database only.
- `npm run db:reset` — delete the local PGlite database (`.data/pglite`, or `PGLITE_DATA_DIR`), then migrate and seed it. Local only: refuses to run when `DATABASE_URL` is set or the folder is outside `.data/`. Stop `npm run dev` first.

Next.js here is a newer version than the model knows: follow [`AGENTS.md`](AGENTS.md) and read `node_modules/next/dist/docs/` before writing Next code. `cacheComponents` is on in `next.config.ts`.

## Conventions

- All database access goes through the data-access layer; no queries in components or route handlers.
- Every protected server action calls `requireRole(team, "owner" | "member")` first. Visitor actions read the anonymous ID through the shared helper.
- Validate all input with zod at the boundary. Env vars are validated once in one module.
- Keep the schema portable across PGlite and Postgres: no extensions, no native enums (text + check constraint), app-generated string IDs.
- Migrations are backwards-compatible: add before remove, never a destructive change in the same release as the code that stops using it.
- Schema changes follow `docs/database-er-diagram.md`; update that file in the same PR. `actor_id` is a plain string (`anon:<cookie>` or `member:<id>`), never a foreign key.
- Removal vs deletion (`SPEC.md` G8): Teams and Boards are deleted for good, cascading down the tree, only through the Owner's type-to-confirm flow. Members are removed softly (`removed_at`) so history keeps their name. Ideas and Comments are never deleted, only hidden.
- Link tokens: store hashes only, never log them, consume on POST.
- Never store or log IP addresses beyond the rate-limit key.
- UI: style only with the `DESIGN.md` tokens (CSS variables and the shadcn theme in `src/app/globals.css`); never hard-code colours, fonts or radii in components. Desktop only (1024px and wider); mobile is out of MVP scope.
- UI copy comes from `SPEC.md` and `CONTEXT.md`, not from Stitch sample text.
- Match the surrounding code's style. No dependencies without asking.

## Workflow

1. Pick a PLAN task and the user story it implements; restate the acceptance criteria.
2. Write tests first for security-sensitive logic (links, sessions, roles, rate limits, votes). For UI, tests may follow the code.
3. Implement the smallest change that meets the criteria.
4. Run lint, typecheck and tests before declaring done, then ask the `qa-engineer` subagent to review the diff; fix its findings and have it re-check.
5. If behaviour changes, update `SPEC.md` first; if a term is new or changes, update `CONTEXT.md`; if styling or a component changes, update `DESIGN.md` first and re-upload it with `stitch upload design DESIGN.md` (this creates a new Stitch design system, so tell the user).
6. Work on a branch and open a PR per task. `main` is protected: it needs a PR and the three CI checks (lint/typecheck/unit, real-Postgres integration, Playwright e2e). Do not merge, push to `main` or promote a production deployment without the user's say-so.

## Definition of done

- Lint, typecheck, unit and integration tests pass (and `npm run test:pg` for database changes).
- E2E passes for changed user flows.
- Acceptance criteria in `SPEC.md` are covered by tests.
- The `qa-engineer` subagent (`.claude/agents/qa-engineer.md`) has reviewed the diff and its report is addressed; blocking findings are fixed or dismissed by the user in the PR.
- `PLAN.md`, `SPEC.md`, `CONTEXT.md` and `docs/database-er-diagram.md` still match the code.

## Ask before

Adding a dependency, changing the schema in a non-additive way (including any cascade or delete rule), touching auth or link handling, changing a documented decision, re-uploading `DESIGN.md` to Stitch (each upload creates another design system, and the Stitch CLI cannot delete screens or design systems), deploying, or anything that sends data outside this repo.
