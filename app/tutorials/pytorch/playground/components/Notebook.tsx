"use client";

import { useState, useRef, useCallback, useEffect } from "react";

import { CodeCell } from "./CodeCell";
import { MarkdownCell } from "./MarkdownCell";
import { executeCode } from "./execute-code";
import type { CellData, CellType } from "./types";

/* ------------------------------------------------------------------ */
/*  Frameworks & helpers                                               */
/* ------------------------------------------------------------------ */

interface Framework {
  label: string;
  setup: string;
}

const FRAMEWORKS: Record<string, Framework> = {
  "torch-latest": {
    label: "PyTorch (latest)",
    setup: "import torch\nimport torch.nn as nn\nimport torch.nn.functional as F",
  },
  none: {
    label: "No auto-import",
    setup: "",
  },
};

function makeCell(type: CellType, code = ""): CellData {
  return {
    id: crypto.randomUUID(),
    type,
    code,
    output: null,
    error: null,
    running: false,
    editing: type === "markdown" && code === "",
  };
}

const STARTER_CELLS: CellData[] = [
  makeCell("code", "torch.__version__"),
  makeCell("code", "x = torch.randint(0, 10, (2, 2))\nx"),
];

/* ------------------------------------------------------------------ */
/*  Notebook                                                           */
/* ------------------------------------------------------------------ */

export default function Notebook() {
  const [framework, setFramework] = useState("torch-latest");
  const [sessionReady, setSessionReady] = useState(false);
  const [cells, setCells] = useState<CellData[]>(() =>
    STARTER_CELLS.map((c) => ({ ...c, id: crypto.randomUUID() })),
  );
  const sessionId = useRef(crypto.randomUUID());

  const initSession = useCallback(async (fw: string) => {
    setSessionReady(false);
    await fetch("/api/execute-python", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId.current }),
    });
    sessionId.current = crypto.randomUUID();
    const setup = FRAMEWORKS[fw].setup;
    if (setup) {
      await fetch("/api/execute-python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "print('Session ready')",
          setup,
          sessionId: sessionId.current,
        }),
      });
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    initSession(framework);
  }, [framework, initSession]);

  const runCell = useCallback(
    async (cellId: string, code: string) => {
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId
            ? { ...c, running: true, output: null, error: null }
            : c,
        ),
      );
      const result = await executeCode(code, sessionId.current);
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId
            ? {
                ...c,
                running: false,
                output: result.stdout || null,
                error: result.stderr || null,
              }
            : c,
        ),
      );
    },
    [],
  );

  const updateCell = useCallback((id: string, patch: Partial<CellData>) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const deleteCell = useCallback((id: string) => {
    setCells((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  }, []);

  const addCell = useCallback((type: CellType) => {
    setCells((prev) => [...prev, makeCell(type)]);
  }, []);

  return (
    <div className="space-y-3">
      {/* Framework selector */}
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-2.5">
        <label
          htmlFor="framework-select"
          className="text-xs font-semibold tracking-wide text-foreground/70 uppercase"
        >
          Framework
        </label>
        <select
          id="framework-select"
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent/50"
        >
          {Object.entries(FRAMEWORKS).map(([key, fw]) => (
            <option key={key} value={key}>
              {fw.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-foreground/60">
          {sessionReady ? "\u25CF Session active" : "\u25CB Starting\u2026"}
        </span>
      </div>

      {/* Cells */}
      {cells.map((cell, i) =>
        cell.type === "code" ? (
          <CodeCell
            key={cell.id}
            cell={cell}
            index={i}
            onChange={(code) => updateCell(cell.id, { code })}
            onRun={() => runCell(cell.id, cell.code)}
            onDelete={cells.length > 1 ? () => deleteCell(cell.id) : undefined}
          />
        ) : (
          <MarkdownCell
            key={cell.id}
            cell={cell}
            onChange={(code) => updateCell(cell.id, { code })}
            onToggleEdit={() => updateCell(cell.id, { editing: !cell.editing })}
            onDelete={cells.length > 1 ? () => deleteCell(cell.id) : undefined}
          />
        ),
      )}

      {/* Blank click area */}
      <div
        className="group/add relative min-h-24 cursor-text"
        onClick={() => addCell("markdown")}
        role="button"
        aria-label="Click to add markdown cell"
      >
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center opacity-0 transition group-hover/add:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); addCell("code"); }}
            className="pointer-events-auto rounded-md border border-border/60 bg-card px-3 py-1 text-xs text-foreground/70 shadow-sm transition hover:border-border hover:text-foreground"
            aria-label="Add code cell"
          >
            + Code
          </button>
        </div>
      </div>
    </div>
  );
}
