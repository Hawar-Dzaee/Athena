import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TOPICS, type Topic } from "@/lib/tutorials";
import { SiteHeader } from "./components/SiteHeader";
import { Sidebar } from "./components/Sidebar";
import { SiteFooter } from "./components/SiteFooter";
import { SidebarProvider, SidebarWrapper } from "./components/SidebarToggle";

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
  const topics = Object.keys(TOPICS) as Topic[];

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SidebarProvider>
          <SiteHeader />
          <div className="flex flex-1">
            <SidebarWrapper>
              <Sidebar topics={topics} />
            </SidebarWrapper>
            <main className="flex-1">{children}</main>
          </div>
          <SiteFooter />
        </SidebarProvider>
      </body>
    </html>
  );
}
