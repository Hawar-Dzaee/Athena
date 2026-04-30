import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "The determinant, geometrically",
  description:
    "Drag two column vectors and watch the parallelogram they span — its signed area is the determinant.",
};

export default function Page() {
  return <Content />;
}
