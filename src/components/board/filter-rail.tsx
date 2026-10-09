import Link from "next/link";
import { IDEA_STATUSES } from "@/db/schema";
import { boardHref, type BoardQuery } from "@/lib/board-query";
import { STATUS_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

type Option = { label: string; href: string; active: boolean };

function Group({ title, options }: { title: string; options: Option[] }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-1">
      <h2 className="mb-1 text-[13px] font-medium tracking-[0.16px] text-muted-foreground">
        {title}
      </h2>
      {options.map((option) => (
        <Link
          key={option.label}
          href={option.href}
          aria-current={option.active ? "true" : undefined}
          className={cn(
            "rounded-sm px-2 py-1 text-sm text-body outline-none focus-visible:ring-2 focus-visible:ring-ring",
            option.active && "bg-muted font-medium text-ink",
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

/** Sort, status and tag filters as plain links, so the page works without JavaScript. */
export function FilterRail({
  basePath,
  query,
  tags,
}: {
  basePath: string;
  query: BoardQuery;
  tags: { id: string; name: string }[];
}) {
  const href = (patch: Parameters<typeof boardHref>[2]) => boardHref(basePath, query, patch);
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6">
      <Group
        title="Sort"
        options={[
          { label: "Top", href: href({ sort: "top" }), active: query.sort === "top" },
          { label: "Newest", href: href({ sort: "newest" }), active: query.sort === "newest" },
        ]}
      />
      <Group
        title="Status"
        options={[
          { label: "All", href: href({ status: null }), active: !query.status },
          ...IDEA_STATUSES.map((status) => ({
            label: STATUS_LABELS[status],
            href: href({ status }),
            active: query.status === status,
          })),
        ]}
      />
      {tags.length > 0 ? (
        <Group
          title="Tags"
          options={[
            { label: "All", href: href({ tag: null }), active: !query.tag },
            ...tags.map((tag) => ({
              label: tag.name,
              href: href({ tag: tag.id }),
              active: query.tag === tag.id,
            })),
          ]}
        />
      ) : null}
    </aside>
  );
}
