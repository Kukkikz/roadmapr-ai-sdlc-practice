import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BoardQuery } from "@/lib/board-query";

/** A plain GET form: the search text goes in `q` and the other filters ride along as hidden fields. */
export function SearchForm({ basePath, query }: { basePath: string; query: BoardQuery }) {
  return (
    <form action={basePath} method="get" role="search" className="flex items-end gap-2">
      {query.sort !== "top" ? <input type="hidden" name="sort" value={query.sort} /> : null}
      {query.status ? <input type="hidden" name="status" value={query.status} /> : null}
      {query.tag ? <input type="hidden" name="tag" value={query.tag} /> : null}
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor="board-search">Search ideas</Label>
        <Input
          id="board-search"
          name="q"
          type="search"
          maxLength={100}
          defaultValue={query.q ?? ""}
          placeholder="Search titles and descriptions"
        />
      </div>
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}
