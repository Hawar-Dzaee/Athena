import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "HingeStdLoss",
  description:
    "How HingeStdLoss prevents point collapse by enforcing a minimum per-feature standard deviation — with interactive scatter plot and heatmap demos.",
};

export default function Page() {
  return <Content />;
}
