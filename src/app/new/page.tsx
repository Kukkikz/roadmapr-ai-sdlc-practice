import type { Metadata } from "next";
import { CreateTeamForm } from "@/components/team/create-team-form";

export const metadata: Metadata = {
  title: "Create a Team · Roadmapr",
  description: "Create a Team and its first Board.",
};

export default function NewTeamPage() {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-6 p-12">
      <CreateTeamForm />
    </main>
  );
}
