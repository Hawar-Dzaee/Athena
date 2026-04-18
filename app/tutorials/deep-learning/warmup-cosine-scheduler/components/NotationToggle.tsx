"use client";

import { useState, createContext, useContext, type ReactNode } from "react";
import { motion } from "framer-motion";
import katex from "katex";

type Notation = "code" | "math";

const NotationContext = createContext<{
  notation: Notation;
  toggle: () => void;
}>({ notation: "code", toggle: () => {} });

export function NotationProvider({ children }: { children: ReactNode }) {
  const [notation, setNotation] = useState<Notation>("code");
  return (
    <NotationContext.Provider
      value={{ notation, toggle: () => setNotation((n) => (n === "code" ? "math" : "code")) }}
    >
      {children}
    </NotationContext.Provider>
  );
}

export function NotationSwitch() {
  const { notation, toggle } = useContext(NotationContext);
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${notation === "code" ? "math" : "code"} notation`}
      className="relative flex h-9 w-52 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1"
    >
      <motion.div
        className="absolute h-7 w-[calc(50%-4px)] rounded-lg bg-[var(--color-foreground)]/10"
        animate={{ x: notation === "code" ? 4 : "calc(100% + 4px)" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
      <span
        className={`relative z-10 flex-1 text-center text-xs font-semibold transition-colors ${
          notation === "code"
            ? "text-[var(--color-foreground)]"
            : "text-[var(--color-muted-foreground)]"
        }`}
      >
        Code
      </span>
      <span
        className={`relative z-10 flex-1 text-center text-xs font-semibold transition-colors ${
          notation === "math"
            ? "text-[var(--color-foreground)]"
            : "text-[var(--color-muted-foreground)]"
        }`}
      >
        Math
      </span>
    </button>
  );
}

function renderKatex(latex: string): string {
  return katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    trust: true,
  });
}

export function Equation({
  code,
  math,
}: {
  code: string;
  math: string;
}) {
  const { notation } = useContext(NotationContext);
  const latex = notation === "code" ? code : math;
  const html = renderKatex(latex);

  return (
    <div className="my-6 overflow-x-auto">
      <motion.div
        key={notation}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
