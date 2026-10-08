import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Portable Postgres only: no extensions, no native enums, app-generated string ids.
// Keep in sync with docs/database-er-diagram.md.

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const IDEA_STATUSES = ["open", "planned", "in_progress", "shipped", "declined"] as const;
export const MEMBER_ROLES = ["owner", "member"] as const;
export const BOARD_VISIBILITIES = ["public", "private"] as const;
export const LINK_KINDS = ["owner", "member_invite", "board_share"] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type BoardVisibility = (typeof BOARD_VISIBILITIES)[number];
export type LinkKind = (typeof LINK_KINDS)[number];

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

// `anon:<cookie-id>` or `member:<member-id>`; never a foreign key.
const actorShape = (column: AnyPgColumn) =>
  sql`(${column} like 'anon:%' or ${column} like 'member:%')`;

export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt(),
});

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    role: text("role").$type<MemberRole>().notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("members_role_check", sql`${t.role} in (${inList(MEMBER_ROLES)})`),
    index("members_team_id_idx").on(t.teamId),
  ],
);

export const boards = pgTable(
  "boards",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    visibility: text("visibility").$type<BoardVisibility>().notNull().default("public"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("boards_team_id_slug_unique").on(t.teamId, t.slug),
    check("boards_visibility_check", sql`${t.visibility} in (${inList(BOARD_VISIBILITIES)})`),
    index("boards_team_id_idx").on(t.teamId),
  ],
);

export const ideas = pgTable(
  "ideas",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").$type<IdeaStatus>().notNull().default("open"),
    actorId: text("actor_id").notNull(),
    authorName: text("author_name"),
    hidden: boolean("hidden").notNull().default(false),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
    search: tsvector("search").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))`,
    ),
  },
  (t) => [
    unique("ideas_id_board_id_unique").on(t.id, t.boardId),
    check("ideas_status_check", sql`${t.status} in (${inList(IDEA_STATUSES)})`),
    check("ideas_actor_id_check", actorShape(t.actorId)),
    index("ideas_board_status_created_idx").on(t.boardId, t.status, t.createdAt),
    index("ideas_unreviewed_idx")
      .on(t.boardId, t.createdAt)
      .where(sql`${t.reviewedAt} is null`),
    index("ideas_search_idx").using("gin", t.search),
  ],
);

export const votes = pgTable(
  "votes",
  {
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.ideaId, t.actorId] }),
    check("votes_actor_id_check", actorShape(t.actorId)),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    actorId: text("actor_id").notNull(),
    authorName: text("author_name"),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check("comments_actor_id_check", actorShape(t.actorId)),
    index("comments_idea_created_idx").on(t.ideaId, t.createdAt),
  ],
);

export const ideaStatusEvents = pgTable(
  "idea_status_events",
  {
    id: text("id").primaryKey(),
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    fromStatus: text("from_status").$type<IdeaStatus>().notNull(),
    toStatus: text("to_status").$type<IdeaStatus>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("idea_status_events_actor_id_check", actorShape(t.actorId)),
    check("idea_status_events_from_check", sql`${t.fromStatus} in (${inList(IDEA_STATUSES)})`),
    check("idea_status_events_to_check", sql`${t.toStatus} in (${inList(IDEA_STATUSES)})`),
    index("idea_status_events_idea_idx").on(t.ideaId, t.createdAt),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
  },
  (t) => [
    unique("tags_board_id_name_unique").on(t.boardId, t.name),
    unique("tags_id_board_id_unique").on(t.id, t.boardId),
    index("tags_board_id_idx").on(t.boardId),
  ],
);

// board_id repeats the Board of both the Idea and the Tag; the composite foreign keys
// make it impossible to apply a Tag to an Idea on another Board.
export const ideaTags = pgTable(
  "idea_tags",
  {
    ideaId: text("idea_id").notNull(),
    tagId: text("tag_id").notNull(),
    boardId: text("board_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ideaId, t.tagId] }),
    foreignKey({
      name: "idea_tags_idea_board_fk",
      columns: [t.ideaId, t.boardId],
      foreignColumns: [ideas.id, ideas.boardId],
    }).onDelete("cascade"),
    foreignKey({
      name: "idea_tags_tag_board_fk",
      columns: [t.tagId, t.boardId],
      foreignColumns: [tags.id, tags.boardId],
    }).onDelete("cascade"),
  ],
);

export const accessLinks = pgTable(
  "access_links",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    boardId: text("board_id").references(() => boards.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind").$type<LinkKind>().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("access_links_token_hash_unique").on(t.tokenHash),
    check("access_links_kind_check", sql`${t.kind} in (${inList(LINK_KINDS)})`),
    check(
      "access_links_shape_check",
      sql`(
        (${t.kind} = 'owner' and ${t.memberId} is not null and ${t.boardId} is null)
        or (${t.kind} = 'member_invite' and ${t.memberId} is null and ${t.boardId} is null)
        or (${t.kind} = 'board_share' and ${t.boardId} is not null and ${t.memberId} is null)
      )`,
    ),
  ],
);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
