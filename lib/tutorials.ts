/**
 * Central registry of tutorials. Adding a new tutorial = adding an entry here
 * + creating the corresponding `app/tutorials/<topic>/<slug>/page.mdx`.
 *
 * This file is the only place that needs to know the full set of tutorials,
 * which keeps the landing page in sync without scanning the filesystem.
 */

export type Topic = "linear-algebra" | "statistics" | "probability" | "deep-learning" | "pytorch" | "regularization" | "optimizer" | "math";

export type TutorialStatus = "ready" | "wip" | "planned";

export interface Tutorial {
  slug: string;
  topic: Topic;
  title: string;
  blurb: string;
  status: TutorialStatus;
  /** Estimated minutes to read+play through. Optional. */
  minutes?: number;
  /** Slug of the parent tutorial within the same topic (for sub-pages). */
  parent?: string;
}

export const TOPICS: Record<Topic, { label: string; description: string; accent: string }> = {
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
  regularization: {
    label: "Regularization",
    description: "Techniques that prevent collapse, overfitting, and degenerate solutions.",
    accent: "from-cyan-500 to-blue-500",
  },
  optimizer: {
    label: "Optimizer",
    description: "Learning rate strategies and parameter update rules for training neural networks.",
    accent: "from-fuchsia-500 to-purple-500",
  },
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
  math: {
    label: "Math",
    description: "Foundational tools — transforms, series, core machinery.",
    accent: "from-sky-500 to-blue-500",
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
    slug: "determinant",
    topic: "linear-algebra",
    title: "The determinant, geometrically",
    blurb:
      "Drag two column vectors and watch the parallelogram they span — its signed area is the determinant.",
    status: "ready",
    minutes: 7,
  },
  {
    slug: "l2-norm",
    topic: "linear-algebra",
    title: "The L2 norm, geometrically",
    blurb:
      "Drag a vector and watch its length update — the L2 norm is the Pythagorean theorem in disguise.",
    status: "ready",
    minutes: 6,
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
  {
    slug: "resnet18",
    topic: "deep-learning",
    title: "ResNet-18, module by module",
    blurb:
      "An interactive diagram of torchvision.models.resnet18() — every block, every skip, every parameter count.",
    status: "ready",
    minutes: 8,
  },
  {
    slug: "adaptive-avg-pool2d",
    topic: "pytorch",
    title: "AdaptiveAvgPool2d",
    blurb:
      "See how nn.AdaptiveAvgPool2d partitions an input grid into regions and averages each one to produce a fixed-size output.",
    status: "ready",
    minutes: 4,
  },
  {
    slug: "vicreg",
    topic: "regularization",
    title: "VICReg: Variance–Invariance–Covariance",
    blurb:
      "Toggle each loss term on and off to see how variance, invariance, and covariance regularization prevent representation collapse.",
    status: "ready",
    minutes: 10,
  },
  {
    slug: "playground",
    topic: "deep-learning",
    title: "Neural Network Playground",
    blurb:
      "A minimal multi-layer perceptron — input, hidden, and output neurons wired together.",
    status: "ready",
  },
  {
    slug: "lars",
    topic: "optimizer",
    title: "LARS: Layer-wise Adaptive Rate Scaling",
    blurb:
      "See how LARS computes a per-layer learning rate from weight and gradient norms — and why that unlocks large-batch training.",
    status: "ready",
    minutes: 8,
  },
  {
    slug: "vicreg-losses",
    topic: "regularization",
    title: "VICReg Loss Functions — Anatomy",
    blurb:
      "Break down HingeStdLoss, CovarianceLoss, and VICRegLoss with the exact code from eb_jepa — each with an interactive drag-to-explore demo.",
    status: "ready",
    minutes: 10,
  },
  {
    slug: "hinge-std-loss",
    topic: "regularization",
    title: "HingeStdLoss",
    blurb:
      "How HingeStdLoss prevents point collapse by enforcing a minimum per-feature standard deviation — with interactive scatter plot and heatmap demos.",
    status: "ready",
    minutes: 5,
    parent: "vicreg-losses",
  },
  {
    slug: "bcs",
    topic: "regularization",
    title: "BCS: Batched Characteristic Slicing",
    blurb:
      "How BCS enforces Gaussianity on random 1D projections to prevent representation collapse — with interactive characteristic function and loss demos.",
    status: "ready",
    minutes: 10,
  },
  {
    slug: "gaussian-distribution",
    topic: "statistics",
    title: "Gaussian Distribution",
    blurb:
      "The bell curve explained — its equation, its parameters, the isotropic special case, and interactive plots you can reshape.",
    status: "ready",
    minutes: 8,
  },
  {
    slug: "warmup-cosine-scheduler",
    topic: "deep-learning",
    title: "Warmup Cosine Scheduler",
    blurb:
      "Visualize how warmup + cosine annealing shapes the learning rate across training — and why the ramp matters.",
    status: "ready",
    minutes: 7,
  },
  {
    slug: "covariance",
    topic: "statistics",
    title: "Covariance",
    blurb:
      "How two variables move together — the formula, the quadrant trick, and a drag-to-explore scatter plot.",
    status: "ready",
    minutes: 6,
  },
  {
    slug: "projection",
    topic: "linear-algebra",
    title: "Projection, geometrically",
    blurb:
      "Drag two vectors and watch one cast a shadow onto the other — the dot product does the work.",
    status: "ready",
    minutes: 7,
  },
  {
    slug: "fourier-transform",
    topic: "math",
    title: "The Fourier Transform",
    blurb:
      "Decompose a signal into frequencies — watch the cos and sin integrals cancel or reinforce as you sweep ω.",
    status: "ready",
    minutes: 10,
  },
  {
    slug: "discrete-fourier-transform",
    topic: "math",
    title: "Discrete Fourier Transform (DFT)",
    blurb:
      "Decompose a discrete signal into frequency bins — watch the sum terms cancel or reinforce as you sweep k.",
    status: "ready",
    minutes: 10,
  },
  {
    slug: "euler-formula",
    topic: "math",
    title: "Euler's Formula",
    blurb:
      "e^(iθ) = cos(θ) + i·sin(θ) — set θ and watch the point on the unit circle. Hit play to trace the full circle.",
    status: "ready",
    minutes: 5,
  },
  {
    slug: "trigonometry",
    topic: "math",
    title: "Trigonometry: Circle & Wave",
    blurb:
      "See how a point on a circle generates sine and cosine waves — drag amplitude A and angle x to explore A·cos(x) and A·sin(x).",
    status: "ready",
    minutes: 6,
  },
];

export function tutorialPath(t: Tutorial): string {
  if (t.parent) {
    return `/tutorials/${t.topic}/${t.parent}/${t.slug}`;
  }
  return `/tutorials/${t.topic}/${t.slug}`;
}

export function tutorialsByTopic(topic: Topic): Tutorial[] {
  return TUTORIALS.filter((t) => t.topic === topic);
}
