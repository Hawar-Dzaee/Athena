import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "ResNet-18: Feature Map Flow",
  description:
    "Watch feature maps transform as an image flows through every layer of ResNet-18 — from raw pixels to class predictions.",
};

export default function Page() {
  return <Content />;
}
