import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The Create board dialog imports a Server Action; its body is not needed to render the panel.
vi.mock("@/components/team/board-actions", () => ({ createBoardAction: vi.fn() }));

const { BoardsPanel } = await import("@/components/team/boards-panel");

const render = (props: Parameters<typeof BoardsPanel>[0]) =>
  renderToStaticMarkup(createElement(BoardsPanel, props));

const board = (id: string, name: string, slug: string, isPublic = true) => ({
  id,
  name,
  slug,
  isPublic,
});

describe("BoardsPanel (US-4.1, US-4.3)", () => {
  it("lists the Team's Boards as plain links to /{team}/{board}, with their visibility", () => {
    const html = render({
      boards: [
        board("1", "Feature requests", "feature-requests"),
        board("2", "Secret", "secret", false),
      ],
      teamSlug: "acme",
      isOwner: false,
    });
    expect(html).toContain('href="/acme/feature-requests"');
    expect(html).toContain("Feature requests");
    expect(html).toContain('href="/acme/secret"');
    expect(html).toContain("Public");
    expect(html).toContain("Private");
    expect(html).not.toContain("No Boards yet");
  });

  it("offers an Owner of a Team with no Boards the first one", () => {
    const html = render({ boards: [], teamSlug: "acme", isOwner: true });
    expect(html).toContain("No Boards yet. Create the first one");
    expect(html).toContain("Create board");
  });

  it("tells a Member of a Team with no Boards to ask an Owner, with no Create button", () => {
    const html = render({ boards: [], teamSlug: "acme", isOwner: false });
    expect(html).toContain("No Boards yet. Ask an Owner to create one.");
    expect(html).not.toContain("Create board");
  });

  it("gives Owners the Create board button even when Boards exist, and Members never", () => {
    const boards = [board("1", "Ideas", "ideas-board")];
    expect(render({ boards, teamSlug: "acme", isOwner: true })).toContain("Create board");
    expect(render({ boards, teamSlug: "acme", isOwner: false })).not.toContain("Create board");
  });

  it("escapes Board names instead of rendering markup", () => {
    const html = render({
      boards: [board("1", "<img src=x onerror=alert(1)>", "bad")],
      teamSlug: "acme",
      isOwner: false,
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
