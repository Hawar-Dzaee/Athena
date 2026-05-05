import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Projection, geometrically",
  description:
    "Drag two vectors and watch one cast a shadow onto the other — the dot product does the work.",
};

export default function Page() {
  return <Content />;
}
