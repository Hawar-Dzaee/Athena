"use client";

import { useState, useMemo, useCallback } from "react";

/* ---------- helpers ---------- */

/** Seeded PRNG (mulberry32) for deterministic grids */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Compute region [start, end) for output index k given input/output sizes */
function regionBounds(k: number, inSize: number, outSize: number) {
  const start = Math.floor((k * inSize) / outSize);
  const end = Math.floor(((k + 1) * inSize) / outSize);
  return { start, end };
}

/** Generate a deterministic input grid */
function generateGrid(size: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  const grid: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      row.push(Math.round(rng() * 9 * 10) / 10); // 0.0 – 9.0, one decimal
    }
    grid.push(row);
  }
  return grid;
}

/** Compute a single output cell value */
function poolValue(
  grid: number[][],
  rStart: number,
  rEnd: number,
  cStart: number,
  cEnd: number
): number {
  let sum = 0;
  let count = 0;
  for (let r = rStart; r < rEnd; r++) {
    for (let c = cStart; c < cEnd; c++) {
      sum += grid[r][c];
      count++;
    }
  }
  return sum / count;
}

/* ---------- color ---------- */

const HIGHLIGHT_BG = "rgba(99,102,241,0.25)"; // indigo overlay
const HIGHLIGHT_BORDER = "rgb(99,102,241)";
const OUTPUT_HIGHLIGHT = "rgb(99,102,241)";

/* ---------- component ---------- */

export default function AdaptivePoolViz() {
  const [inputSize, setInputSize] = useState(7);
  const [outputSize, setOutputSize] = useState(3);
  const [seed, setSeed] = useState(42);
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(
    null
  );

  const grid = useMemo(() => generateGrid(inputSize, seed), [inputSize, seed]);

  const output = useMemo(() => {
    const out: number[][] = [];
    for (let r = 0; r < outputSize; r++) {
      const row: number[] = [];
      const rb = regionBounds(r, inputSize, outputSize);
      for (let c = 0; c < outputSize; c++) {
        const cb = regionBounds(c, inputSize, outputSize);
        row.push(poolValue(grid, rb.start, rb.end, cb.start, cb.end));
      }
      out.push(row);
    }
    return out;
  }, [grid, inputSize, outputSize]);

  /** Which input cells belong to the hovered output cell */
  const highlightedRegion = useMemo(() => {
    if (!hovered) return null;
    const rb = regionBounds(hovered.r, inputSize, outputSize);
    const cb = regionBounds(hovered.c, inputSize, outputSize);
    return { rStart: rb.start, rEnd: rb.end, cStart: cb.start, cEnd: cb.end };
  }, [hovered, inputSize, outputSize]);

  const isHighlighted = useCallback(
    (r: number, c: number) => {
      if (!highlightedRegion) return false;
      const { rStart, rEnd, cStart, cEnd } = highlightedRegion;
      return r >= rStart && r < rEnd && c >= cStart && c < cEnd;
    },
    [highlightedRegion]
  );

  const handleReshuffle = () => setSeed((s) => s + 1);

  /* Sizing: cells get smaller as grid grows so it doesn't blow up */
  const inputCellPx = inputSize <= 5 ? 52 : inputSize <= 7 ? 44 : 36;
  const outputCellPx = outputSize <= 3 ? 56 : 48;

  return (
    <div className="not-prose my-10 rounded-2xl border border-border bg-card p-6">
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-end gap-6">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            Input size:{" "}
            <span className="font-mono text-accent">{inputSize}x{inputSize}</span>
          </span>
          <input
            type="range"
            min={3}
            max={10}
            value={inputSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              setInputSize(v);
              if (outputSize > v) setOutputSize(v);
            }}
            className="w-36 accent-accent"
            aria-label="Input size"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            Output size:{" "}
            <span className="font-mono text-accent">{outputSize}x{outputSize}</span>
          </span>
          <input
            type="range"
            min={1}
            max={inputSize}
            value={outputSize}
            onChange={(e) => setOutputSize(Number(e.target.value))}
            className="w-36 accent-accent"
            aria-label="Output size"
          />
        </label>

        <button
          onClick={handleReshuffle}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          aria-label="Reshuffle input values"
        >
          Reshuffle
        </button>
      </div>

      {/* Grids */}
      <div className="flex flex-wrap items-start justify-center gap-10">
        {/* Input grid */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Input ({inputSize}x{inputSize})
          </span>
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `repeat(${inputSize}, ${inputCellPx}px)`,
              gridTemplateRows: `repeat(${inputSize}, ${inputCellPx}px)`,
            }}
          >
            {/* Region overlay rectangles — drawn behind cells */}
            {highlightedRegion && (
              <div
                className="pointer-events-none absolute z-10 rounded-sm"
                style={{
                  top: highlightedRegion.rStart * inputCellPx,
                  left: highlightedRegion.cStart * inputCellPx,
                  width:
                    (highlightedRegion.cEnd - highlightedRegion.cStart) *
                    inputCellPx,
                  height:
                    (highlightedRegion.rEnd - highlightedRegion.rStart) *
                    inputCellPx,
                  background: HIGHLIGHT_BG,
                  border: `2px solid ${HIGHLIGHT_BORDER}`,
                }}
              />
            )}
            {grid.map((row, r) =>
              row.map((val, c) => (
                <div
                  key={`${r}-${c}`}
                  className="relative z-20 flex items-center justify-center border border-border font-mono text-xs transition-colors"
                  style={{
                    width: inputCellPx,
                    height: inputCellPx,
                    color: isHighlighted(r, c)
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                    fontWeight: isHighlighted(r, c) ? 700 : 400,
                  }}
                >
                  {val.toFixed(1)}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center justify-center self-center text-muted-foreground">
          <svg
            width="48"
            height="24"
            viewBox="0 0 48 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 12h38m0 0l-8-8m8 8l-8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-widest">
            pool
          </span>
        </div>

        {/* Output grid */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Output ({outputSize}x{outputSize})
          </span>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${outputSize}, ${outputCellPx}px)`,
              gridTemplateRows: `repeat(${outputSize}, ${outputCellPx}px)`,
            }}
          >
            {output.map((row, r) =>
              row.map((val, c) => {
                const isActive =
                  hovered && hovered.r === r && hovered.c === c;
                return (
                  <div
                    key={`${r}-${c}`}
                    className="flex cursor-pointer items-center justify-center border font-mono text-sm font-semibold transition-colors"
                    style={{
                      width: outputCellPx,
                      height: outputCellPx,
                      borderColor: isActive
                        ? OUTPUT_HIGHLIGHT
                        : "var(--border)",
                      background: isActive ? HIGHLIGHT_BG : "transparent",
                      color: isActive
                        ? OUTPUT_HIGHLIGHT
                        : "var(--foreground)",
                    }}
                    onMouseEnter={() => setHovered({ r, c })}
                    onMouseLeave={() => setHovered(null)}
                    role="gridcell"
                    aria-label={`Output row ${r}, column ${c}: ${val.toFixed(2)}`}
                  >
                    {val.toFixed(2)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Arithmetic breakdown */}
      <div className="mt-6 min-h-[3.5rem]">
        {hovered && highlightedRegion ? (
          <Arithmetic
            grid={grid}
            region={highlightedRegion}
            outputVal={output[hovered.r][hovered.c]}
            outR={hovered.r}
            outC={hovered.c}
          />
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Hover over an output cell to see the averaging arithmetic.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Arithmetic sub-component ---------- */

function Arithmetic({
  grid,
  region,
  outputVal,
  outR,
  outC,
}: {
  grid: number[][];
  region: { rStart: number; rEnd: number; cStart: number; cEnd: number };
  outputVal: number;
  outR: number;
  outC: number;
}) {
  const { rStart, rEnd, cStart, cEnd } = region;
  const values: number[] = [];
  for (let r = rStart; r < rEnd; r++) {
    for (let c = cStart; c < cEnd; c++) {
      values.push(grid[r][c]);
    }
  }
  const count = values.length;

  return (
    <div className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
      <p className="mb-1 font-medium" style={{ color: OUTPUT_HIGHLIGHT }}>
        out[{outR},{outC}]
      </p>
      <p className="font-mono text-xs leading-relaxed text-muted-foreground">
        = ({values.map((v) => v.toFixed(1)).join(" + ")}) / {count}
        <br />
        = {values.reduce((a, b) => a + b, 0).toFixed(1)} / {count}
        {" = "}
        <span className="font-semibold text-foreground">
          {outputVal.toFixed(2)}
        </span>
      </p>
    </div>
  );
}
