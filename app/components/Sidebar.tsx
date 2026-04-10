import Link from "next/link";

import { TOPICS, tutorialsByTopic, tutorialPath, type Topic } from "@/lib/tutorials";

export function Sidebar({ topics }: { topics: Topic[] }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/60 md:block">
      <nav className="sticky top-14 space-y-6 overflow-y-auto p-6" aria-label="Topics">
        {topics.map((topic) => {
          const meta = TOPICS[topic];
          const items = tutorialsByTopic(topic);
          return (
            <div key={topic}>
              <h3 className="text-xs font-semibold tracking-[0.15em] text-foreground/70 uppercase">
                {meta.label}
              </h3>
              {items.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {items.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={tutorialPath(t)}
                        className="block rounded-md px-2 py-1.5 text-sm text-foreground/80 transition hover:bg-muted/50 hover:text-foreground"
                      >
                        {t.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs italic text-foreground/50">Coming soon</p>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
