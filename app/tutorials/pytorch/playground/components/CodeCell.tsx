"use client";

import { useEffect, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";

import { editorTheme } from "./editor-theme";
import type { CellData } from "./types";

export function CodeCell({
  cell,
  index,
  onChange,
  onRun,
  onDelete,
}: {
  cell: CellData;
  index: number;
  onChange: (code: string) => void;
  onRun: () => void;
  onDelete?: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      python(),
      oneDark,
      editorTheme,
      EditorView.contentAttributes.of({ style: "min-height: 44px" }),
      Prec.highest(
        keymap.of([
          {
            key: "Shift-Enter",
            run: () => { onRunRef.current(); return true; },
          },
          {
            key: "Mod-Enter",
            run: () => { onRunRef.current(); return true; },
          },
        ]),
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];

    const state = EditorState.create({ doc: cell.code, extensions });
    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="group flex transition">
      {/* Left gutter — play button + cell number */}
      <div className="flex w-10 shrink-0 flex-col items-center pt-2.5">
        <button
          onClick={onRun}
          disabled={cell.running}
          className="flex h-6 w-6 items-center justify-center rounded text-sm text-accent transition hover:bg-accent/10 disabled:opacity-50"
          aria-label="Run cell"
        >
          {cell.running ? "\u23F3" : "\u25B6"}
        </button>
        <span className="mt-0.5 font-mono text-[10px] text-foreground/50">{index + 1}</span>
      </div>

      {/* Cell body */}
      <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card focus-within:border-accent/50">
        <div className="relative">
          <div ref={editorRef} className="px-1 py-1" />
          {onDelete && (
            <button
              onClick={onDelete}
              className="absolute right-2 top-1.5 rounded px-1.5 py-0.5 text-xs text-foreground/60 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
              aria-label="Delete cell"
            >
              {"\u2715"}
            </button>
          )}
        </div>

        {(cell.output || cell.error) && (
          <div className="border-t border-border/40 bg-muted/30 px-4 py-3">
            {cell.output && (
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground/90">
                {cell.output}
              </pre>
            )}
            {cell.error && (
              <pre className="whitespace-pre-wrap font-mono text-sm text-red-500">
                {cell.error}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
