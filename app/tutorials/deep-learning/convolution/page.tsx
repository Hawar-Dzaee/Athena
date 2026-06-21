import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Convolution",
  description:
    "Slide an editable 3×3 kernel across an image and watch the convolved output build up, pixel by pixel.",
};

export default function Page() {
  return <Content />;
}
