import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Athena — interactive tutorials for math & ML",
    template: "%s · Athena",
  },
  description:
    "Interactive, visual tutorials for linear algebra, statistics, probability, and deep learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-accent to-primary"
          />
          Athena
        </Link>
        <nav className="flex items-center gap-6 text-sm text-foreground/70">
          <Link
            href="/tutorials/linear-algebra/vector-addition"
            className="transition hover:text-foreground"
          >
            Tutorials
          </Link>
          <a
            href="https://github.com/yizhe-ang/k-means-explorable"
            target="_blank"
            rel="noreferrer noopener"
            className="transition hover:text-foreground"
          >
            Inspiration
          </a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 text-sm text-foreground/60">
        <span>Athena · interactive tutorials</span>
        <span>Built with Next.js, MDX, D3, and react-three-fiber</span>
      </div>
    </footer>
  );
}
