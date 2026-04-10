/**
 * Central registry of tutorials. Adding a new tutorial = adding an entry here
 * + creating the corresponding `app/tutorials/<topic>/<slug>/page.mdx`.
 *
 * This file is the only place that needs to know the full set of tutorials,
 * which keeps the landing page in sync without scanning the filesystem.
 */

export type Topic = "linear-algebra" | "statistics" | "probability" | "deep-learning" | "pytorch";

export type TutorialStatus = "ready" | "wip" | "planned";

export interface Tutorial {
  slug: string;
  topic: Topic;
  title: string;
  blurb: string;
  status: TutorialStatus;
  /** Estimated minutes to read+play through. Optional. */
  minutes?: number;
}

export const TOPICS: Record<Topic, { label: string; description: string; accent: string }> = {
  "linear-algebra": {
    label: "Linear Algebra",
    description: "Vectors, matrices, transformations — geometry first.",
    accent: "from-indigo-500 to-violet-500",
  },
  statistics: {
    label: "Statistics",
    description: "Distributions, estimators, uncertainty.",
    accent: "from-emerald-500 to-teal-500",
  },
  probability: {
    label: "Probability",
    description: "Sample spaces, conditional reasoning, Bayes.",
    accent: "from-amber-500 to-orange-500",
  },
  "deep-learning": {
    label: "Deep Learning",
    description: "Architectures, training dynamics, intuition pumps.",
    accent: "from-rose-500 to-pink-500",
  },
  pytorch: {
    label: "PyTorch",
    description: "Interactive PyTorch playground — run real code in the browser.",
    accent: "from-red-500 to-orange-500",
  },
};

export const TUTORIALS: Tutorial[] = [
  {
    slug: "vector-addition",
    topic: "linear-algebra",
    title: "Vector addition, geometrically",
    blurb:
      "Drag two vectors and watch their sum update — in 2D and 3D. The first concept in Athena.",
    status: "ready",
    minutes: 6,
  },
  {
    slug: "playground",
    topic: "pytorch",
    title: "PyTorch Playground",
    blurb: "Write and run PyTorch code interactively, notebook-style.",
    status: "ready",
  },
  {
    slug: "transformation",
    topic: "pytorch",
    title: "Transformations",
    blurb:
      "Explore CIFAR-10 samples and learn how PyTorch transforms preprocess images for training.",
    status: "ready",
    minutes: 5,
  },
];

export function tutorialPath(t: Tutorial): string {
  return `/tutorials/${t.topic}/${t.slug}`;
}

export function tutorialsByTopic(topic: Topic): Tutorial[] {
  return TUTORIALS.filter((t) => t.topic === topic);
}
