import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";

const prettyCodeOptions: PrettyCodeOptions = {
  theme: "one-dark-pro",
  keepBackground: false,
  defaultLang: "plaintext",
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [
      [rehypeKatex, { strict: false, output: "htmlAndMathml" }],
      [rehypePrettyCode, prettyCodeOptions],
    ],
  },
});

/*
 * Bundler note: we run with `next dev --webpack` / `next build --webpack`
 * (see package.json scripts) instead of Turbopack. Reason: rehype-pretty-code
 * (Shiki) and rehype-katex are JS plugin functions, and Turbopack's loader
 * pipeline currently can't serialize non-plain options through @next/mdx.
 * Revisit this when Next.js ships first-class Turbopack MDX plugin support.
 */
const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  async rewrites() {
    return [
      {
        source: "/api/train",
        destination: "http://localhost:8000/train",
      },
    ];
  },
};

export default withMDX(nextConfig);
