import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Covariance",
  description:
    "How two variables move together — the formula, the quadrant trick, and a drag-to-explore scatter plot.",
};

export default function Page() {
  return <Content />;
}
