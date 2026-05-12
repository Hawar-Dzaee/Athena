import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "The Fourier Transform",
  description:
    "Decompose a signal into frequencies — watch the cos and sin integrals cancel or reinforce as you sweep ω.",
};

export default function Page() {
  return <Content />;
}
