import { Badge } from "@/components/ui/badge";
import { tagMarkerClass } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

/** A Tag on an Idea: the soft grey chip with its colour as a 4px left marker (DESIGN.md). */
export function TagChip({ name, color }: { name: string; color: string }) {
  return <Badge className={cn("border-l-4", tagMarkerClass(color))}>{name}</Badge>;
}
