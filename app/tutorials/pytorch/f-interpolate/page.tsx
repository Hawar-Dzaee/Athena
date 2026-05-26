import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "F.interpolate",
  description:
    "See how F.interpolate resizes a feature map — choose nearest, bilinear, or bicubic mode and toggle align_corners to watch the coordinate mapping and per-pixel arithmetic change.",
};

export default function Page() {
  return <Content />;
}
