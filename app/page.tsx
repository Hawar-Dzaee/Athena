import Link from "next/link";

import { TOPICS, TUTORIALS, tutorialPath, tutorialsByTopic, type Topic } from "@/lib/tutorials";

export default function HomePage() {
  const topics = Object.keys(TOPICS) as Topic[];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16">
      <section className="mb-16 max-w-3xl">
        <p className="mb-4 text-sm font-medium tracking-[0.18em] text-accent uppercase">
          Athena
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Interactive tutorials for math, statistics &amp; deep learning.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/70">
          Built one concept at a time. Drag, slide, and click to build intuition the way visual
          learners actually do — then read the math when you&apos;re ready for it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={tutorialPath(TUTORIALS[0])}
            className="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:opacity-90"
          >
            Start with vector addition →
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-sm font-medium tracking-[0.18em] text-foreground/60 uppercase">
          Topics
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {topics.map((topic) => (
            <TopicCard key={topic} topic={topic} />
          ))}
        </div>
      </section>
    </div>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  const meta = TOPICS[topic];
  const items = tutorialsByTopic(topic);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition hover:border-border">
      <div
        aria-hidden
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.accent} opacity-70`}
      />
      <h3 className="text-xl font-semibold text-foreground">{meta.label}</h3>
      <p className="mt-1 text-sm text-foreground/65">{meta.description}</p>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/45 italic">No tutorials yet. Coming soon.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((t) => (
            <li key={t.slug}>
              <Link
                href={tutorialPath(t)}
                className="-mx-3 flex items-baseline justify-between gap-4 rounded-lg border border-transparent px-3 py-2 transition hover:border-border hover:bg-muted/40"
              >
                <span className="font-medium text-foreground">{t.title}</span>
                <span className="text-xs text-foreground/50">
                  {t.minutes ? `${t.minutes} min` : t.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
