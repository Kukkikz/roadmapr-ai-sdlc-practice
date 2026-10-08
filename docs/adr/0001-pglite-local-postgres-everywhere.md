# PGlite locally, Postgres everywhere, one schema

Local development and tests use PGlite (Postgres compiled to WebAssembly) and production uses Neon Postgres, so there is a single Drizzle `pg-core` schema and one set of migrations. We rejected SQLite for local dev because it would force two schema files, dialect-specific queries and dual-database CI, and would let Postgres-only bugs reach production.

## Considered Options

- **SQLite locally, Postgres in prod:** most mature and fastest to start, but requires two schemas and per-dialect rules (search, upserts, enums, timestamps).
- **Postgres in Docker locally:** full parity, but adds a Docker dependency to local setup.

## Consequences

- PGlite is newer and single-process. Some Postgres extensions may be unavailable, and local dev cannot share one database across processes.
- CI still runs the integration tests against real Postgres to catch PGlite/Postgres differences.
