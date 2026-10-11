import type { Metadata } from "next";
import { BoardJoinPage } from "@/components/auth/board-join-page";

// A secret link must never be indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Page({ params }: PageProps<"/join/board/[token]">) {
  return <BoardJoinPage token={params.then((p) => p.token)} />;
}
