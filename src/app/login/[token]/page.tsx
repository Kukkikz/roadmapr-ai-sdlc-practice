import type { Metadata } from "next";
import { RedeemPage } from "@/components/auth/redeem-page";

// A secret link must never be indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Page({ params }: PageProps<"/login/[token]">) {
  return <RedeemPage kind="owner" token={params.then((p) => p.token)} />;
}
