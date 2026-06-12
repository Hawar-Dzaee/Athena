import type { Metadata } from "next";

import Content from "./content.mdx";

export const metadata: Metadata = {
  title: "Video JEPA — the parallel rollout",
  description:
    "Unroll the parallel-mode n-step prediction loop from eb_jepa. Pick the number of frames and watch the light-cone of predictions-of-predictions deepen step by step until it saturates at T−2.",
};

export default function Page() {
  return <Content />;
}
