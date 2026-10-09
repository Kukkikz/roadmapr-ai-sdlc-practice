import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { ideaStatusEvents, ideaTags, ideas, tags, type IdeaStatus } from "@/db/schema";
import { newId } from "@/db/id";
import type { Db } from "./types";

export async function createIdea(
  db: Db,
  input: {
    boardId: string;
    title: string;
    description?: string;
    actorId: string;
    authorName?: string | null;
  },
) {
  const [row] = await db
    .insert(ideas)
    .values({ id: newId(), ...input })
    .returning();
  return row;
}

export type IdeaSort = "top" | "newest";

export type ListIdeasOptions = {
  boardId: string;
  sort?: IdeaSort;
  status?: IdeaStatus;
  tagId?: string;
  /** Keyword search over title and description (Postgres full-text, English). */
  search?: string;
  /** Moderators see hidden Ideas; the public does not. */
  includeHidden?: boolean;
  limit?: number;
  offset?: number;
};

// Counts are correlated subqueries, so one round trip returns the whole page (no N+1).
const voteCountSql = sql<number>`(select count(*)::int from votes where votes.idea_id = ideas.id)`;
// The public count skips hidden Comments; moderators (includeHidden) count them all.
const commentCountSql = (includeHidden: boolean) =>
  includeHidden
    ? sql<number>`(select count(*)::int from comments where comments.idea_id = ideas.id)`
    : sql<number>`(select count(*)::int from comments where comments.idea_id = ideas.id and comments.hidden = false)`;

/** One page of a Board's Ideas with vote count, comment count and Tags. */
export async function listIdeas(db: Db, opts: ListIdeasOptions) {
  const conditions: SQL[] = [eq(ideas.boardId, opts.boardId)];
  if (!opts.includeHidden) conditions.push(eq(ideas.hidden, false));
  if (opts.status) conditions.push(eq(ideas.status, opts.status));
  if (opts.tagId) {
    conditions.push(
      sql`exists (select 1 from idea_tags where idea_tags.idea_id = ideas.id and idea_tags.tag_id = ${opts.tagId})`,
    );
  }
  const search = opts.search?.trim();
  if (search) conditions.push(sql`${ideas.search} @@ plainto_tsquery('english', ${search})`);

  const order =
    (opts.sort ?? "top") === "top"
      ? [desc(voteCountSql), desc(ideas.createdAt), desc(ideas.id)]
      : [desc(ideas.createdAt), desc(ideas.id)];

  const rows = await db
    .select({
      id: ideas.id,
      boardId: ideas.boardId,
      title: ideas.title,
      description: ideas.description,
      status: ideas.status,
      actorId: ideas.actorId,
      authorName: ideas.authorName,
      hidden: ideas.hidden,
      reviewedAt: ideas.reviewedAt,
      createdAt: ideas.createdAt,
      voteCount: voteCountSql,
      commentCount: commentCountSql(opts.includeHidden ?? false),
    })
    .from(ideas)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  const tagRows = rows.length
    ? await db
        .select({ ideaId: ideaTags.ideaId, id: tags.id, name: tags.name, color: tags.color })
        .from(ideaTags)
        .innerJoin(tags, eq(ideaTags.tagId, tags.id))
        .where(
          inArray(
            ideaTags.ideaId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  const byIdea = new Map<string, { id: string; name: string; color: string }[]>();
  for (const { ideaId, ...tag } of tagRows) {
    byIdea.set(ideaId, [...(byIdea.get(ideaId) ?? []), tag]);
  }
  return rows.map((row) => ({ ...row, tags: byIdea.get(row.id) ?? [] }));
}

/**
 * One Idea, or null. Pass `boardId` so an Idea id from another Board does not resolve under
 * this Board's URL. Hidden Ideas resolve only with `includeHidden` (moderators); the public
 * gets null, which the page renders as not found.
 */
export async function getIdea(
  db: Db,
  ideaId: string,
  opts: { boardId?: string; includeHidden?: boolean } = {},
) {
  const conditions: SQL[] = [eq(ideas.id, ideaId)];
  if (opts.boardId) conditions.push(eq(ideas.boardId, opts.boardId));
  if (!opts.includeHidden) conditions.push(eq(ideas.hidden, false));
  const [row] = await db
    .select({
      idea: ideas,
      voteCount: voteCountSql,
      commentCount: commentCountSql(opts.includeHidden ?? false),
    })
    .from(ideas)
    .where(and(...conditions));
  if (!row) return null;
  const ideaTagRows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(ideaTags)
    .innerJoin(tags, eq(ideaTags.tagId, tags.id))
    .where(eq(ideaTags.ideaId, ideaId));
  return {
    ...row.idea,
    voteCount: row.voteCount,
    commentCount: row.commentCount,
    tags: ideaTagRows,
  };
}

/** Ideas are never deleted, only hidden. */
export async function setIdeaHidden(db: Db, ideaId: string, hidden: boolean) {
  const [row] = await db.update(ideas).set({ hidden }).where(eq(ideas.id, ideaId)).returning();
  return row ?? null;
}

/**
 * Changes an Idea's status and records who changed it, in one statement (no transaction,
 * so it also works over Neon's HTTP driver). Any transition is allowed. Returns false when
 * the Idea does not exist or already has that status.
 */
export async function setIdeaStatus(db: Db, ideaId: string, to: IdeaStatus, actorId: string) {
  const result = await db.execute(sql`
    with prev as (
      select id, status from ideas where id = ${ideaId} for update
    ), upd as (
      update ideas set status = ${to}
      from prev
      where ideas.id = prev.id and prev.status <> ${to}
      returning ideas.id
    )
    insert into idea_status_events (id, idea_id, actor_id, from_status, to_status)
    select ${newId()}, prev.id, ${actorId}, prev.status, ${to}
    from prev join upd on upd.id = prev.id
    returning id
  `);
  // Every Postgres driver Drizzle wraps returns `{ rows }` here.
  return (result as unknown as { rows: unknown[] }).rows.length > 0;
}

export function listStatusEvents(db: Db, ideaId: string) {
  return db
    .select()
    .from(ideaStatusEvents)
    .where(eq(ideaStatusEvents.ideaId, ideaId))
    .orderBy(ideaStatusEvents.createdAt);
}

export const ROADMAP_STATUSES = ["planned", "in_progress", "shipped"] as const;

/** Visible Ideas for the roadmap columns, most voted first. `open` and `declined` never appear. */
export async function listRoadmapIdeas(db: Db, boardId: string) {
  const columns = await Promise.all(
    ROADMAP_STATUSES.map((status) => listIdeas(db, { boardId, status, sort: "top" })),
  );
  return {
    planned: columns[0],
    in_progress: columns[1],
    shipped: columns[2],
  };
}
