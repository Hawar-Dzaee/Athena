import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Conv3d",
  description:
    "Scan a 3D kernel across a multi-channel video volume — pick the number of input channels and the time-depth, then watch the receptive field sweep through the cube to fill the output.",
};

export default function Page() {
  return <Content />;
}
