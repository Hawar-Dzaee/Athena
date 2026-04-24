import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "VICReg Loss Functions — Anatomy",
  description:
    "Break down HingeStdLoss, CovarianceLoss, and VICRegLoss from eb_jepa — each explained with the exact code and an interactive demo.",
};

export default function Page() {
  return <Content />;
}
