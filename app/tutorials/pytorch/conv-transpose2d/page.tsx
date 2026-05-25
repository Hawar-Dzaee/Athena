import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "ConvTranspose2d",
  description:
    "See how nn.ConvTranspose2d upsamples a feature map by stamping scaled kernel copies at stride-spaced positions and summing overlaps.",
};

export default function Page() {
  return <Content />;
}
