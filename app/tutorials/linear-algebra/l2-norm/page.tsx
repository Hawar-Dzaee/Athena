import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "The L2 norm, geometrically",
  description:
    "Drag a vector and watch its length update — the L2 norm is just the Pythagorean theorem in disguise.",
};

export default function Page() {
  return <Content />;
}
