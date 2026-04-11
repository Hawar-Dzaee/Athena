import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "ResNet-18, module by module",
  description:
    "An interactive, node-by-node diagram of torchvision.models.resnet18() — every block, every skip, every parameter count.",
};

export default function Page() {
  return <Content />;
}
