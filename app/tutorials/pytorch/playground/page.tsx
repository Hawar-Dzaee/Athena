import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "PyTorch Playground",
  description:
    "Write and run PyTorch code interactively, notebook-style.",
};

export default function Page() {
  return <Content />;
}
