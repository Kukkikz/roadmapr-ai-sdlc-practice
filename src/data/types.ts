import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "@/db/schema";

/** Any Drizzle Postgres database: Neon, PGlite or node-postgres. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
