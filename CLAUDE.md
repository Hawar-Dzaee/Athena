# Athena

Interactive web app for math and ML tutorials, built one concept at a time. Reference inspiration: [yizhe-ang/k-means-explorable](https://github.com/yizhe-ang/k-means-explorable) and [TensorFlow Playground](https://playground.tensorflow.org/).

Topics in scope (growing over time):

- **Linear algebra** — vectors, matrices, transformations (3D matters here)
- **Statistics** — distributions, estimators, uncertainty
- **Probability** — sample spaces, conditional reasoning, Bayes
- **Deep learning** — including clickable architecture diagrams (Transformer, ResNet, …)
- **Playgrounds** — TensorFlow Playground-style live in-browser training

## Audience and quality bar

Personal use right now, but will go public later. **Treat every tutorial as polished from day one** — no "ship fast, fix before going public" hacks. Visual polish, typography, accessibility, and interaction quality all matter from the start.

## Tech stack (locked — do not relitigate without explicit ask)

**Foundation**

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 (uses `@theme` blocks in CSS, not `tailwind.config.js`)
- Vercel (target host when going public)

**Content authoring**

- MDX (`@next/mdx`) — every tutorial is a `.mdx` file with embedded React components
- `remark-math` + `rehype-katex` for LaTeX equations
- `rehype-pretty-code` (Shiki) for syntax-highlighted code blocks
- Next.js `<Image>` for jpg/png/gif

**Visualization** (each library has one job — they coexist, don't consolidate)

| Need                                                    | Library                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| 2D plots, vectors, distributions, custom SVG            | `d3`                                     |
| 3D scenes (linear algebra, loss landscapes, embeddings) | `@react-three/fiber` + `@react-three/drei` |
| Node-based architecture diagrams (Transformer, ResNet)  | `@xyflow/react`                          |
| Animation / transitions                                 | `framer-motion`                          |

**ML in the browser**

- `@tensorflow/tfjs` — for TF Playground-style interactive trainers
- `onnxruntime-web` (not yet installed) — when we want to run real pre-trained models

**UI utilities**

- `clsx`, `tailwind-merge` (merged via [`lib/cn.ts`](lib/cn.ts))
- `class-variance-authority`, `lucide-react`

## Critical build decisions

### 1. Bundler: webpack, NOT Turbopack

`package.json` scripts run `next dev --webpack` and `next build --webpack`. Reason: Turbopack's loader pipeline can't currently serialize the JS plugin functions used by `rehype-pretty-code` (Shiki) and `rehype-katex` through `@next/mdx`. The Rust loader (`mdxRs`) doesn't yet support arbitrary rehype plugins either.

**Do not remove the `--webpack` flags** until Next.js ships first-class Turbopack support for MDX plugins. There's a comment to this effect in [next.config.ts](next.config.ts).

### 2. Tutorial file pattern: `page.tsx` + `content.mdx` split

Every tutorial is a folder with three things:

- **`content.mdx`** — prose + embedded interactive components
- **`page.tsx`** — tiny server component that exports `metadata` and renders `<Content />` from the MDX
- **`components/`** — interactive React components (each starts with `"use client"`)

**Why split:** in the App Router, an MDX file that imports client components can't also export `metadata` — the loader treats the whole module as client, and `metadata` must be server-side. The `page.tsx` wrapper is the standard workaround. **Don't try to put `metadata` directly in a `page.mdx` — it will fail to build.**

## File structure

```
app/
├── layout.tsx                  # site shell (header, footer, fonts, dark mode)
├── page.tsx                    # landing — reads from lib/tutorials.ts
├── globals.css                 # design tokens + KaTeX + Shiki line styles
└── tutorials/
    ├── layout.tsx              # shared tutorial wrapper (back link, prose container)
    └── <topic>/<slug>/
        ├── page.tsx            # exports metadata, renders <Content />
        ├── content.mdx         # the actual lesson
        └── components/         # client components for this tutorial only
lib/
├── cn.ts                       # tailwind class merger
└── tutorials.ts                # central registry — single source of truth
mdx-components.tsx              # global MDX → JSX styling (h1/h2/code/img/Figure/...)
next.config.ts                  # MDX + remark/rehype pipeline
```

## Adding a new tutorial

1. Add an entry to the `TUTORIALS` array in [lib/tutorials.ts](lib/tutorials.ts) (slug, topic, title, blurb, status, minutes).
2. Create `app/tutorials/<topic>/<slug>/`.
3. In that folder, add:
   - `content.mdx` — prose + math + embedded components
   - `page.tsx` — exports `metadata`, renders `<Content />` from `./content.mdx`
   - `components/` — any client components needed for this tutorial
4. The landing page picks it up automatically — no other file changes required.

**Never modify existing tutorial files when adding a new one.** If shared utilities are genuinely needed, put them in `lib/` or a new `components/viz/` folder — but resist premature abstraction. **Three similar tutorials before extracting a shared component.**

## Commands

```sh
npm run dev          # dev server with hot reload (webpack)
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

## Conventions

- **One concept per tutorial.** Don't bundle multiple ideas into one file.
- **Use the right viz library for the right job.** Don't do 3D in D3, or architecture diagrams in raw SVG.
- **MDX is prose; React components are interactivity.** Drop a `<Component />` in the middle of a paragraph when that's what makes the lesson land.
- **Math uses LaTeX.** `$...$` for inline, `$$...$$` for display blocks.
- **Code snippets use fenced blocks** with a language tag — Shiki handles theming.
- **Don't add `'use client'` to MDX files.** Put client logic in components inside `components/` and import them.
- **Color tokens** live in [app/globals.css](app/globals.css) as CSS variables exposed to Tailwind via `@theme inline`. Use semantic utilities (`bg-background`, `text-foreground`, `border-border`, `text-accent`) — don't hardcode colors.
- **Accessibility:** every interactive widget needs a `role`/`aria-label`, every image needs `alt` text. Adding it later is harder.

## Reference: the first tutorial

[app/tutorials/linear-algebra/vector-addition/](app/tutorials/linear-algebra/vector-addition/) is the visual + interaction template every later tutorial inherits. It exercises every piece of the stack — MDX, KaTeX, Shiki, D3-style 2D SVG with drag, and react-three-fiber 3D with orbit controls. When in doubt about a pattern, look there first.
