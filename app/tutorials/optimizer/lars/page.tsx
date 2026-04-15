import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "LARS: Layer-wise Adaptive Rate Scaling",
  description:
    "See how LARS computes a per-layer learning rate from weight and gradient norms — and why that unlocks large-batch training.",
};

export default function Page() {
  return <Content />;
}
