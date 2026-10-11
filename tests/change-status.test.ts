import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoard, createIdea, getIdea, listStatusEvents } from "@/data";
import { teams } from "@/db/schema";
import { changeIdeaStatus } from "@/lib/change-status";
import { createTestDb } from "./helpers/db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let counter = 0;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(async () => {
  await ctx.close();
});

async function newTeam() {
  const n = ++counter;
  const team = { id: `team-${n}`, name: `Team ${n}`, slug: `team-${n}` };
  await ctx.db.insert(teams).values(team);
  return team;
}
async function newIdea(teamId: string) {
  const n = ++counter;
  const board = await createBoard(ctx.db, { teamId, name: `B${n}`, slug: `b-${n}` });
  return createIdea(ctx.db, { boardId: board.id, title: "Idea", actorId: "anon:a" });
}
const actor = "member:m1";

describe("changeIdeaStatus (US-5.1, G7)", () => {
  it("changes the status and records who, from and to", async () => {
    const team = await newTeam();
    const idea = await newIdea(team.id);
    expect(await changeIdeaStatus(ctx.db, team.id, actor, idea.id, "planned")).toBe("changed");
    expect((await getIdea(ctx.db, idea.id))?.status).toBe("planned");
    const events = await listStatusEvents(ctx.db, idea.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorId: actor, fromStatus: "open", toStatus: "planned" });
  });

  it("allows any transition, including back to open and out of declined", async () => {
    const team = await newTeam();
    const idea = await newIdea(team.id);
    for (const to of ["shipped", "declined", "in_progress", "open"] as const) {
      expect(await changeIdeaStatus(ctx.db, team.id, actor, idea.id, to)).toBe("changed");
    }
    expect(await listStatusEvents(ctx.db, idea.id)).toHaveLength(4);
  });

  it("records nothing when the status is already that value", async () => {
    const team = await newTeam();
    const idea = await newIdea(team.id);
    expect(await changeIdeaStatus(ctx.db, team.id, actor, idea.id, "open")).toBe("unchanged");
    expect(await listStatusEvents(ctx.db, idea.id)).toHaveLength(0);
  });

  it("can change a hidden Idea", async () => {
    const team = await newTeam();
    const idea = await newIdea(team.id);
    const { setIdeaHidden } = await import("@/data");
    await setIdeaHidden(ctx.db, idea.id, true);
    expect(await changeIdeaStatus(ctx.db, team.id, actor, idea.id, "planned")).toBe("changed");
  });

  it("answers not_found for an Idea on another Team's Board and changes nothing", async () => {
    const mine = await newTeam();
    const theirs = await newTeam();
    const idea = await newIdea(theirs.id);
    expect(await changeIdeaStatus(ctx.db, mine.id, actor, idea.id, "planned")).toBe("not_found");
    expect((await getIdea(ctx.db, idea.id))?.status).toBe("open");
    expect(await listStatusEvents(ctx.db, idea.id)).toHaveLength(0);
  });

  it.each([
    ["an unknown id", "nope"],
    ["a missing id", undefined],
    ["a non-text id", { id: 1 }],
  ])("answers not_found for %s", async (_label, id) => {
    const team = await newTeam();
    expect(await changeIdeaStatus(ctx.db, team.id, actor, id, "planned")).toBe("not_found");
  });

  it.each([
    ["an unknown status", "done"],
    ["a different case", "Planned"],
    ["a missing status", undefined],
    ["a non-text status", 3],
  ])("rejects %s as invalid and changes nothing", async (_label, status) => {
    const team = await newTeam();
    const idea = await newIdea(team.id);
    expect(await changeIdeaStatus(ctx.db, team.id, actor, idea.id, status)).toBe("invalid");
    expect((await getIdea(ctx.db, idea.id))?.status).toBe("open");
    expect(await listStatusEvents(ctx.db, idea.id)).toHaveLength(0);
  });
});
