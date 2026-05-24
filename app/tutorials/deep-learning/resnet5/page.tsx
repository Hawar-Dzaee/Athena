import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "ResNet5, module by module",
  description:
    "An interactive, node-by-node diagram of ResNet5 — a lightweight 3-block residual network with configurable channels, strides, and pooling.",
};

export default function Page() {
  return <Content />;
}
