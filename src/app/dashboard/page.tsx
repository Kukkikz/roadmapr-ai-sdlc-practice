import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";

async function DashboardContent() {
  const session = await getSession();
  // Signed-out visitors get the same page as any unknown URL (G3).
  if (!session) notFound();
  return (
    <>
      <h1 className="text-[40px] leading-[1.2] text-ink">{session.team.name}</h1>
      <p className="text-base text-body">
        Signed in as {session.member.displayName} ({session.member.role}).
      </p>
    </>
  );
}

// Placeholder until the Team dashboard (US-4.3) lands; it exists so sign-in has somewhere to go.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 p-12">
      <Suspense fallback={<p className="text-base text-body">Loading…</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
