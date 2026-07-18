import type { Metadata } from "next";
import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "CosineWithWarmup: composing LR schedulers",
  description:
    "Build a linear-warmup + cosine-annealing schedule by chaining LinearLR and CosineAnnealingLR with SequentialLR — drag total_steps and warmup_ratio to watch the milestone hand-off move.",
};

export default function Page() {
  return <Content />;
}
