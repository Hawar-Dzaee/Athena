import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Vector addition, geometrically",
  description:
    "Drag two vectors and watch their sum update — in 2D and 3D. The first concept in Athena.",
};

export default function Page() {
  return <Content />;
}
