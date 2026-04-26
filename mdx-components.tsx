import type { MDXComponents } from "mdx/types";
import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

type AnchorProps = ComponentPropsWithoutRef<"a">;

function isInternalHref(href: string | undefined): href is string {
  return typeof href === "string" && (href.startsWith("/") || href.startsWith("#"));
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children, ...props }) => (
      <h1
        className="mt-0 mb-6 scroll-mt-24 text-4xl font-semibold tracking-tight text-foreground md:text-5xl"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2
        className="mt-14 mb-4 scroll-mt-24 text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        className="mt-10 mb-3 scroll-mt-24 text-xl font-semibold tracking-tight text-foreground md:text-2xl"
        {...props}
      >
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p className="my-5 text-[1.0625rem] leading-[1.8] text-foreground/85" {...props}>
        {children}
      </p>
    ),
    a: ({ href, children, ...props }: AnchorProps) => {
      if (isInternalHref(href)) {
        return (
          <Link
            href={href}
            className="text-accent underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
          {...props}
        >
          {children}
        </a>
      );
    },
    ul: ({ children, ...props }) => (
      <ul className="my-5 ml-6 list-disc space-y-2 text-foreground/85" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-5 ml-6 list-decimal space-y-2 text-foreground/85" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="leading-[1.8]" {...props}>
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="my-6 border-l-2 border-accent/40 bg-accent/5 px-5 py-3 text-foreground/80 italic"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: (props) => <hr className="my-12 border-border/60" {...props} />,
    code: ({ className, children, ...props }: ComponentPropsWithoutRef<"code">) => {
      // Inline code (rehype-pretty-code attaches `data-language` to block code only).
      const isInline = !(props as Record<string, unknown>)["data-language"];
      if (isInline) {
        return (
          <code
            className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={cn("font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre
        className="my-6 overflow-x-auto rounded-xl border border-border/60 bg-[#282c34] px-5 py-4 text-sm leading-relaxed shadow-sm"
        {...props}
      >
        {children}
      </pre>
    ),
    table: ({ children, ...props }) => (
      <div className="my-6 overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full border-collapse text-left text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border-b border-border/60 bg-muted/40 px-4 py-2 font-semibold text-foreground"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border-b border-border/40 px-4 py-2 text-foreground/85" {...props}>
        {children}
      </td>
    ),
    img: (props) => {
      const { src, alt, width, height } = props as ImageProps;
      if (typeof src === "string") {
        return (
          <Image
            src={src}
            alt={alt ?? ""}
            width={Number(width ?? 1200)}
            height={Number(height ?? 720)}
            className="my-6 rounded-xl border border-border/60"
          />
        );
      }
      // Fallback for non-string sources (gif/animated remote)
      // eslint-disable-next-line @next/next/no-img-element
      return <img {...(props as ComponentPropsWithoutRef<"img">)} alt={alt ?? ""} />;
    },
    Figure: ({ caption, children }: { caption?: ReactNode; children: ReactNode }) => (
      <figure className="my-8">
        {children}
        {caption ? (
          <figcaption className="mt-3 text-center text-sm text-foreground/60">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    ),
    ...components,
  };
}
