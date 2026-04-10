import Link from "next/link";
import { SidebarToggleButton } from "./SidebarToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-6">
        <SidebarToggleButton />
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-accent to-primary"
          />
          Athena
        </Link>
      </div>
    </header>
  );
}
