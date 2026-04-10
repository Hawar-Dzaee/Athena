import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Transformations — PyTorch",
  description:
    "Explore CIFAR-10 samples and learn how PyTorch transforms preprocess images for training.",
};

export default function Page() {
  return <Content />;
}
