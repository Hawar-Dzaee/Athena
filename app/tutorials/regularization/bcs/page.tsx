import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "BCS: Batched Characteristic Slicing",
  description:
    "How BCS enforces Gaussianity on random 1D projections to prevent representation collapse — with interactive characteristic function and loss demos.",
};

export default function Page() {
  return <Content />;
}
