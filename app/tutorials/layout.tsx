import type { ReactNode } from "react";

export default function TutorialsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <article className="tutorial-prose">{children}</article>
    </div>
  );
}
