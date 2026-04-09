import Link from "next/link";
import type { ReactNode } from "react";

export default function TutorialsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-sm text-foreground/60 transition hover:text-foreground"
      >
        ← All tutorials
      </Link>
      <article className="tutorial-prose">{children}</article>
    </div>
  );
}
