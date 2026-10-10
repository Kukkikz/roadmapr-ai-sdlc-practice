import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-[40px] leading-[1.2] text-ink">Roadmapr</h1>
      <p className="text-base text-body">Feedback and roadmap boards for teams.</p>
      <Link href="/new" className={buttonVariants()}>
        Create a Team
      </Link>
    </main>
  );
}
