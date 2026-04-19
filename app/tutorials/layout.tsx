import type { ReactNode } from "react";

export default function TutorialsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-7xl px-8 py-12">
      <article className="tutorial-prose">{children}</article>
    </div>
  );
}
