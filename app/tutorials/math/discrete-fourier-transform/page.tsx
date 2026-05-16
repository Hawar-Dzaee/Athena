import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Discrete Fourier Transform (DFT)",
  description:
    "Decompose a discrete signal into frequency bins — watch the sum terms cancel or reinforce as you sweep k.",
};

export default function Page() {
  return <Content />;
}
