import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Neural Network Playground",
  description:
    "A minimal multi-layer perceptron — input, hidden, and output neurons wired together.",
};

export default function Page() {
  return <Content />;
}
