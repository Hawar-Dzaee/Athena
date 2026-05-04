"use client";

import { useState, useMemo } from "react";

const Z1 = [
  [1.2, 0.5],
  [-0.8, 1.4],
  [0.3, -1.1],
  [-1.5, -0.7],
];

const A_MAT = [
  [0.71, -0.45, 0.95, -0.71],
  [0.71, 0.89, 0.32, 0.71],
];

function matmul(a: number[][], b: number[][]): number[][] {
  return a.map((row) =>
    b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)),
  );
}

function absMax(mat: number[][]): number {
  return Math.max(...mat.flat().map(Math.abs)) || 1;
}

function cellBg(value: number, max: number): string {
  const t = Math.abs(value) / max;
  const a = t * 0.45 + 0.05;
  return value >= 0
    ? `rgba(34, 197, 94, ${a})`
    : `rgba(239, 68, 68, ${a})`;
}

type Hover = { r: number; c: number } | null;

const CELL_W = 52;
const CELL_H = 38;

export function MatMulViz() {
  const [hover, setHover] = useState<Hover>(null);
  const result = useMemo(() => matmul(Z1, A_MAT), []);
  const mZ = useMemo(() => absMax(Z1), []);
  const mA = useMemo(() => absMax(A_MAT), []);
  const mR = useMemo(() => absMax(result), []);

  function renderMatrix(
    data: number[][],
    max: number,
    isActive: (i: number, j: number) => boolean,
    isDimmed: (i: number, j: number) => boolean,
    prefix: string,
    opts?: {
      onEnter?: (i: number, j: number) => void;
      onLeave?: () => void;
    },
  ) {
    const cols = data[0].length;
    return (
      <div className="relative px-1.5 py-0.5">
        <div
          className="absolute bottom-0 left-0 top-0 w-[5px] rounded-l-sm border-b-2 border-l-2 border-t-2 opacity-30"
          style={{ borderColor: "var(--color-muted-foreground)" }}
        />
        <div
          className="absolute bottom-0 right-0 top-0 w-[5px] rounded-r-sm border-b-2 border-r-2 border-t-2 opacity-30"
          style={{ borderColor: "var(--color-muted-foreground)" }}
        />
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${CELL_W}px)`,
          }}
        >
          {data.flatMap((row, i) =>
            row.map((val, j) => {
              const active = isActive(i, j);
              const dimmed = isDimmed(i, j);
              return (
                <div
                  key={`${prefix}-${i}-${j}`}
                  className="flex items-center justify-center rounded font-mono text-[11px] transition-all duration-150"
                  style={{
                    width: CELL_W,
                    height: CELL_H,
                    backgroundColor: cellBg(val, max),
                    boxShadow: active
                      ? "inset 0 0 0 2px #fbbf24"
                      : "inset 0 0 0 1px rgba(255,255,255,0.04)",
                    opacity: dimmed ? 0.15 : 1,
                    cursor: opts ? "pointer" : "default",
                  }}
                  onMouseEnter={opts ? () => opts.onEnter?.(i, j) : undefined}
                  onMouseLeave={opts?.onLeave}
                >
                  {val >= 0 ? " " : ""}
                  {val.toFixed(2)}
                </div>
              );
            }),
          )}
        </div>
      </div>
    );
  }

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="Matrix multiplication visualization: z₁ @ A"
    >
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-5 py-5">
        <div className="flex items-start justify-center gap-3">
          {/* z1 */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold text-[var(--color-foreground)]">
              z₁
            </span>
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {Z1.length}×
              <span className="text-emerald-400">{Z1[0].length}</span>
            </span>
            {renderMatrix(
              Z1,
              mZ,
              (i) => hover !== null && hover.r === i,
              (i) => hover !== null && hover.r !== i,
              "z",
            )}
          </div>

          <span className="mt-11 text-base font-bold text-[var(--color-muted-foreground)]">
            @
          </span>

          {/* A */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold text-[var(--color-foreground)]">
              A
            </span>
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              <span className="text-emerald-400">{A_MAT.length}</span>×
              {A_MAT[0].length}
            </span>
            {renderMatrix(
              A_MAT,
              mA,
              (_i, j) => hover !== null && hover.c === j,
              (_i, j) => hover !== null && hover.c !== j,
              "a",
            )}
          </div>

          <span className="mt-11 text-base font-bold text-[var(--color-muted-foreground)]">
            =
          </span>

          {/* Result */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold text-[var(--color-foreground)]">
              z₁@A
            </span>
            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {result.length}×{result[0].length}
            </span>
            {renderMatrix(
              result,
              mR,
              (i, j) =>
                hover !== null && hover.r === i && hover.c === j,
              (i, j) =>
                hover !== null && !(hover.r === i && hover.c === j),
              "r",
              {
                onEnter: (i, j) => setHover({ r: i, c: j }),
                onLeave: () => setHover(null),
              },
            )}
          </div>
        </div>

      </div>
    </figure>
  );
}
