import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Gaussian Distribution",
  description:
    "The bell curve explained — its equation, its parameters, the isotropic special case, and interactive plots you can reshape.",
};

export default function Page() {
  return <Content />;
}
