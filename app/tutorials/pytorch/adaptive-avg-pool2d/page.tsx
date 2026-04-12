import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "AdaptiveAvgPool2d",
  description:
    "See how nn.AdaptiveAvgPool2d partitions an input grid into regions and averages each one to produce a fixed-size output.",
};

export default function Page() {
  return <Content />;
}
