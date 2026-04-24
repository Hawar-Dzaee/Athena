import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Gaussian Distribution",
  description:
    "The bell curve explained — its equation, its parameters, and an interactive plot you can reshape by dragging μ and σ.",
};

export default function Page() {
  return <Content />;
}
