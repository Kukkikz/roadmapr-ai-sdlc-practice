import { createBoard } from "@/data/boards";
import { addComment } from "@/data/comments";
import { createIdea, setIdeaStatus } from "@/data/ideas";
import { assignTag, createTag } from "@/data/tags";
import type { Db } from "@/data/types";
import { addVote } from "@/data/votes";
import { newId } from "./id";
import { members, teams } from "./schema";

/** Sample data: 1 Team, 2 Boards (one private), Ideas, votes, Comments and Tags. Not idempotent. */
export async function seed(db: Db) {
  const teamId = newId();
  const ownerId = newId();
  await db.insert(teams).values({ id: teamId, name: "Acme", slug: "acme" });
  await db.insert(members).values({ id: ownerId, teamId, displayName: "Ada Owner", role: "owner" });
  const owner = `member:${ownerId}`;

  const product = await createBoard(db, {
    teamId,
    name: "Product feedback",
    slug: "product",
    description: "Tell us what to build next.",
  });
  await createBoard(db, { teamId, name: "Beta testers", slug: "beta", visibility: "private" });

  const ui = await createTag(db, { boardId: product.id, name: "ui", color: "blue" });
  const api = await createTag(db, { boardId: product.id, name: "api", color: "green" });

  const sample = [
    { title: "Dark mode", description: "A dark theme for night owls.", tag: ui, votes: 3 },
    { title: "Public API", description: "REST endpoints for ideas and votes.", tag: api, votes: 2 },
    {
      title: "CSV export",
      description: "Download all ideas as a spreadsheet.",
      tag: null,
      votes: 1,
    },
    {
      title: "Slack notifications",
      description: "Post new ideas to a channel.",
      tag: null,
      votes: 0,
    },
  ];
  for (const [i, s] of sample.entries()) {
    const idea = await createIdea(db, {
      boardId: product.id,
      title: s.title,
      description: s.description,
      actorId: `anon:visitor-${i}`,
      authorName: i % 2 === 0 ? "A visitor" : null,
    });
    if (s.tag) await assignTag(db, idea.id, s.tag.id);
    for (let v = 0; v < s.votes; v++) await addVote(db, idea.id, `anon:voter-${v}`);
    await addComment(db, { ideaId: idea.id, body: "Would love this.", actorId: "anon:voter-0" });
    if (i === 0) {
      await addComment(db, {
        ideaId: idea.id,
        body: "On our list for next quarter.",
        actorId: owner,
        authorName: "Ada Owner",
      });
      await setIdeaStatus(db, idea.id, "planned", owner);
    }
  }
}
