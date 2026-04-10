"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";

const SidebarContext = createContext({ open: true, toggle: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function SidebarToggleButton() {
  const { open, toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      className="hidden md:inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label={open ? "Hide sidebar" : "Show sidebar"}
    >
      {open ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
    </button>
  );
}

export function SidebarWrapper({ children }: { children: ReactNode }) {
  const { open } = useSidebar();
  if (!open) return null;
  return <>{children}</>;
}
