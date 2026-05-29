import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Conv3d",
  description:
    "See how nn.Conv3d slides a 3D kernel through a volume — depth, height, and width — multiplying and summing across every slice it touches.",
};

export default function Page() {
  return <Content />;
}
