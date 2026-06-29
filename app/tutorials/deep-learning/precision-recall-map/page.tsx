import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Precision, Recall, and mAP",
  description:
    "Drag a confidence threshold to trace the precision-recall curve — then see how AP and mAP summarise detector quality across classes.",
};

export default function Page() {
  return <Content />;
}
