import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Portable Postgres only: no extensions, no native enums, app-generated string ids.
// Phase 2 adds the remaining tables from PLAN.md.
export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
