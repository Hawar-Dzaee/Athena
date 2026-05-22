import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Trigonometry: Circle & Wave",
  description:
    "See how a point on a circle generates sine and cosine waves — drag amplitude A and angle x to explore A·cos(x) and A·sin(x).",
};

export default function Page() {
  return <Content />;
}
