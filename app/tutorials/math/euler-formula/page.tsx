import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Euler's Formula",
  description:
    "e^(iθ) = cos(θ) + i·sin(θ) — watch the point trace the unit circle as θ sweeps from 0 to 2π.",
};

export default function Page() {
  return <Content />;
}
