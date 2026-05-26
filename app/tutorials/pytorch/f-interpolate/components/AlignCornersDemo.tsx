"use client";

import { useState } from "react";

const IN = 3;
const OUT = 5;

function coord(idx: number, ac: boolean): number {
  if (ac) return OUT <= 1 ? 0 : idx * (IN - 1) / (OUT - 1);
  return (idx + 0.5) * IN / OUT - 0.5;
}

export default function AlignCornersDemo() {
  const [ac, setAc] = useState(false);

  const W = 400;
  const H = 152;
  const pad = 44;
  const gw = W - 2 * pad;
  const srcW = gw / IN;
  const outW = gw / OUT;
  const ch = 30;
  const sy = 20;
  const oy = 88;

  const coords = Array.from({ length: OUT }, (_, i) => coord(i, ac));

  return (
    <div className="not-prose my-8 rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-4">
        <span className="text-sm font-medium text-foreground font-mono">
          align_corners
        </span>
        <div className="flex overflow-hidden rounded-lg border border-border">
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              onClick={() => setAc(v)}
              className={`px-3 py-1 text-sm font-mono transition-colors ${
                ac === v
                  ? "bg-accent text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v ? "True" : "False"}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto w-full max-w-md"
        role="img"
        aria-label="Coordinate alignment diagram showing how output pixels map to source positions"
      >
        {/* Source label */}
        <text
          x={pad - 6}
          y={sy + ch / 2}
          textAnchor="end"
          dominantBaseline="central"
          fill="currentColor"
          opacity={0.5}
          fontSize={11}
        >
          src
        </text>

        {/* Source cells */}
        {Array.from({ length: IN }, (_, i) => (
          <g key={`s${i}`}>
            <rect
              x={pad + i * srcW}
              y={sy}
              width={srcW}
              height={ch}
              rx={4}
              fill="rgba(59,130,246,0.15)"
              stroke="rgba(59,130,246,0.5)"
              strokeWidth={1.5}
            />
            <text
              x={pad + (i + 0.5) * srcW}
              y={sy + ch / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="currentColor"
              fontSize={13}
              fontFamily="monospace"
            >
              {i}
            </text>
          </g>
        ))}

        {/* Mapping lines + source dots */}
        {coords.map((src, i) => {
          const ox = pad + (i + 0.5) * outW;
          const sx = pad + (src + 0.5) * srcW;
          return (
            <g key={`m${i}`}>
              <line
                x1={ox}
                y1={oy}
                x2={sx}
                y2={sy + ch}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="4,3"
                opacity={0.3}
              />
              <circle
                cx={sx}
                cy={sy + ch + 1}
                r={3}
                fill="rgb(249,115,22)"
                opacity={0.85}
              />
            </g>
          );
        })}

        {/* Output label */}
        <text
          x={pad - 6}
          y={oy + ch / 2}
          textAnchor="end"
          dominantBaseline="central"
          fill="currentColor"
          opacity={0.5}
          fontSize={11}
        >
          out
        </text>

        {/* Output cells */}
        {Array.from({ length: OUT }, (_, i) => (
          <g key={`o${i}`}>
            <rect
              x={pad + i * outW}
              y={oy}
              width={outW}
              height={ch}
              rx={4}
              fill="rgba(249,115,22,0.12)"
              stroke="rgba(249,115,22,0.4)"
              strokeWidth={1.5}
            />
            <text
              x={pad + (i + 0.5) * outW}
              y={oy + ch / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="currentColor"
              fontSize={12}
              fontFamily="monospace"
            >
              {i}
            </text>
          </g>
        ))}

        {/* Mapped source coordinate labels */}
        {coords.map((src, i) => (
          <text
            key={`c${i}`}
            x={pad + (i + 0.5) * outW}
            y={oy + ch + 14}
            textAnchor="middle"
            fill="rgb(249,115,22)"
            fontSize={10}
            fontFamily="monospace"
            opacity={0.9}
          >
            {src.toFixed(1)}
          </text>
        ))}
      </svg>

      <p className="mt-1 text-center text-xs text-muted-foreground">
        {ac
          ? "Corners pinned: out[0] → src 0.0, out[4] → src 2.0. Uniform spacing between samples."
          : "Half-pixel shift: out[0] → src −0.2 (past the edge). Each output pixel covers an equal share of input area."}
      </p>
    </div>
  );
}
