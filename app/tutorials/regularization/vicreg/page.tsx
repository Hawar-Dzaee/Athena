import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "VICReg: Variance–Invariance–Covariance Regularization",
  description:
    "Toggle each loss term on and off to see how variance, invariance, and covariance regularization prevent representation collapse in self-supervised learning.",
};

export default function Page() {
  return <Content />;
}
