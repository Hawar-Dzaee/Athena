import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Warmup Cosine Scheduler",
  description:
    "Visualize how warmup + cosine annealing shapes the learning rate across training — and why the ramp matters.",
};

export default function Page() {
  return <Content />;
}
