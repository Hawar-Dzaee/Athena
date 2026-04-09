"use client";

import { useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

import type { CellData } from "./types";

export function MarkdownCell({
  cell,
  onChange,
  onToggleEdit,
  onDelete,
}: {
  cell: CellData;
  onChange: (code: string) => void;
  onToggleEdit: () => void;
  onDelete?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, []);

  useEffect(() => {
    if (cell.editing) {
      autoResize();
      textareaRef.current?.focus();
    }
  }, [cell.editing, autoResize]);

  if (!cell.editing) {
    return (
      <div className="group relative cursor-text px-1 py-1" onClick={onToggleEdit}>
        {onDelete && (
          <div className="absolute right-0 top-0 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded px-1.5 py-0.5 text-xs text-foreground/40 transition hover:text-red-500"
              aria-label="Delete cell"
            >
              {"\u2715"}
            </button>
          </div>
        )}
        <div className="max-w-none text-foreground/85 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:my-2 [&_p]:leading-relaxed [&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_li]:leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_a]:text-accent [&_a]:underline [&_strong]:text-foreground [&_em]:italic [&_blockquote]:border-l-2 [&_blockquote]:border-foreground/20 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-foreground/60">
          {cell.code ? (
            <ReactMarkdown>{cell.code}</ReactMarkdown>
          ) : (
            <p className="italic text-foreground/35">Click to write&hellip;</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative px-1 py-1">
      {onDelete && (
        <div className="absolute right-0 top-0 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={onDelete}
            className="rounded px-1.5 py-0.5 text-xs text-foreground/40 transition hover:text-red-500"
            aria-label="Delete cell"
          >
            {"\u2715"}
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={cell.code}
        onChange={(e) => { onChange(e.target.value); autoResize(); }}
        onBlur={onToggleEdit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        spellCheck={false}
        className="block w-full resize-none bg-transparent text-[1.0625rem] leading-relaxed text-foreground/85 outline-none"
        rows={1}
        aria-label="Markdown cell"
      />
    </div>
  );
}
