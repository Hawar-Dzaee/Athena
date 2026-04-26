"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { TOPICS, tutorialsByTopic, tutorialPath, type Topic } from "@/lib/tutorials";

export function Sidebar({ topics }: { topics: Topic[] }) {
  const pathname = usePathname();

  const activeTopic = topics.find((topic) =>
    tutorialsByTopic(topic).some((t) => tutorialPath(t) === pathname)
  );

  const [open, setOpen] = useState<Record<string, boolean>>(
    activeTopic ? { [activeTopic]: true } : {}
  );

  function toggle(topic: string) {
    setOpen((prev) => ({ ...prev, [topic]: !prev[topic] }));
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/60 md:block">
      <nav className="sticky top-14 space-y-1 overflow-y-auto p-6" aria-label="Topics">
        {topics.map((topic) => {
          const meta = TOPICS[topic];
          const items = tutorialsByTopic(topic);
          const isOpen = !!open[topic];

          return (
            <div key={topic}>
              <button
                onClick={() => toggle(topic)}
                className="flex w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-xs font-semibold tracking-[0.15em] text-foreground/70 uppercase transition hover:bg-muted/50 hover:text-foreground"
                aria-expanded={isOpen}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                />
                {meta.label}
              </button>

              {isOpen && (
                items.length > 0 ? (
                  <ul className="mt-1 mb-1 space-y-0.5 pl-5">
                    {items.map((t) => {
                      const href = tutorialPath(t);
                      const active = pathname === href;
                      return (
                        <li key={t.slug}>
                          <Link
                            href={href}
                            className={`block rounded-md px-2 py-1.5 text-sm transition ${
                              active
                                ? "border-l-2 border-accent bg-muted/60 pl-[calc(0.5rem-2px)] font-medium text-foreground"
                                : "text-foreground/80 hover:bg-muted/50 hover:text-foreground"
                            }`}
                            aria-current={active ? "page" : undefined}
                          >
                            {t.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 mb-1 pl-5 text-xs italic text-foreground/50">Coming soon</p>
                )
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
