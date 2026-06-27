"use client";

import { useState, useMemo } from "react";

/* ── helpers ── */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = [10, 20, 35, 50, 65, 80, 92, 99];

function makeGrid(size: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => PALETTE[Math.floor(rng() * PALETTE.length)])
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/* ── types ── */

type Mode = "nearest" | "bilinear" | "bicubic";

interface Weight {
  r: number;
  c: number;
  w: number;
}

interface Sample {
  value: number;
  weights: Weight[];
  srcY: number;
  srcX: number;
}

/* ── coordinate mapping ── */

function srcCoord(
  idx: number,
  inSz: number,
  outSz: number,
  ac: boolean,
  mode: Mode
): number {
  if (mode === "nearest") return idx * inSz / outSz;
  if (ac) return outSz <= 1 ? 0 : idx * (inSz - 1) / (outSz - 1);
  return (idx + 0.5) * inSz / outSz - 0.5;
}

/* ── interpolation kernels ── */

function sampleNearest(
  g: number[][],
  sy: number,
  sx: number,
  h: number,
  w: number
): Sample {
  const r = clamp(Math.floor(sy), 0, h - 1);
  const c = clamp(Math.floor(sx), 0, w - 1);
  return { value: g[r][c], weights: [{ r, c, w: 1 }], srcY: sy, srcX: sx };
}

function sampleBilinear(
  g: number[][],
  sy: number,
  sx: number,
  h: number,
  w: number
): Sample {
  const fx = Math.floor(sx),
    fy = Math.floor(sy);
  const wx = sx - fx,
    wy = sy - fy;
  const x0 = clamp(fx, 0, w - 1),
    x1 = clamp(fx + 1, 0, w - 1);
  const y0 = clamp(fy, 0, h - 1),
    y1 = clamp(fy + 1, 0, h - 1);

  const pairs: [number, number, number][] = [
    [y0, x0, (1 - wy) * (1 - wx)],
    [y0, x1, (1 - wy) * wx],
    [y1, x0, wy * (1 - wx)],
    [y1, x1, wy * wx],
  ];

  let value = 0;
  const wm = new Map<string, Weight>();
  for (const [r, c, wt] of pairs) {
    value += wt * g[r][c];
    const k = `${r},${c}`;
    const e = wm.get(k);
    if (e) e.w += wt;
    else wm.set(k, { r, c, w: wt });
  }

  return {
    value,
    weights: [...wm.values()].filter((e) => e.w > 1e-4),
    srcY: sy,
    srcX: sx,
  };
}

function cubicK(x: number): number {
  const a = -0.75,
    ax = Math.abs(x);
  if (ax <= 1) return (a + 2) * ax ** 3 - (a + 3) * ax ** 2 + 1;
  if (ax < 2) return a * ax ** 3 - 5 * a * ax ** 2 + 8 * a * ax - 4 * a;
  return 0;
}

function sampleBicubic(
  g: number[][],
  sy: number,
  sx: number,
  h: number,
  w: number
): Sample {
  const fx = Math.floor(sx),
    fy = Math.floor(sy);
  let value = 0;
  const wm = new Map<string, Weight>();

  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      const r = clamp(fy + dy, 0, h - 1);
      const c = clamp(fx + dx, 0, w - 1);
      const wt = cubicK(sy - (fy + dy)) * cubicK(sx - (fx + dx));
      if (Math.abs(wt) > 1e-4) {
        value += wt * g[r][c];
        const k = `${r},${c}`;
        const e = wm.get(k);
        if (e) e.w += wt;
        else wm.set(k, { r, c, w: wt });
      }
    }
  }

  return {
    value,
    weights: [...wm.values()].filter((e) => Math.abs(e.w) > 1e-4),
    srcY: sy,
    srcX: sx,
  };
}

function sample(
  g: number[][],
  r: number,
  c: number,
  inSz: number,
  outSz: number,
  mode: Mode,
  ac: boolean
): Sample {
  const sy = srcCoord(r, inSz, outSz, ac, mode);
  const sx = srcCoord(c, inSz, outSz, ac, mode);
  switch (mode) {
    case "nearest":
      return sampleNearest(g, sy, sx, inSz, inSz);
    case "bilinear":
      return sampleBilinear(g, sy, sx, inSz, inSz);
    case "bicubic":
      return sampleBicubic(g, sy, sx, inSz, inSz);
  }
}

/* ── color ── */

function valColor(v: number): string {
  const t = clamp(v / 100, 0, 1);
  // Viridis keypoints: dark purple → blue-purple → teal → green → yellow
  const stops = [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ] as const;
  const seg = t * (stops.length - 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  const r = Math.round(stops[i][0] + f * (stops[i + 1][0] - stops[i][0]));
  const g = Math.round(stops[i][1] + f * (stops[i + 1][1] - stops[i][1]));
  const b = Math.round(stops[i][2] + f * (stops[i + 1][2] - stops[i][2]));
  return `rgba(${r}, ${g}, ${b}, 0.65)`;
}

const HL = { bg: "rgba(99,102,241,0.25)", border: "rgb(99,102,241)" };

/* ── component ── */

const MODES: Mode[] = ["nearest", "bilinear", "bicubic"];

export default function InterpolateViz() {
  const [inSz, setInSz] = useState(4);
  const [outSz, setOutSz] = useState(7);
  const [mode, setMode] = useState<Mode>("bilinear");
  const [ac, setAc] = useState(false);
  const [seed, setSeed] = useState(42);
  const [hov, setHov] = useState<{ r: number; c: number } | null>(null);

  const grid = useMemo(() => makeGrid(inSz, seed), [inSz, seed]);

  const out = useMemo(() => {
    const res: Sample[][] = [];
    for (let r = 0; r < outSz; r++) {
      const row: Sample[] = [];
      for (let c = 0; c < outSz; c++)
        row.push(sample(grid, r, c, inSz, outSz, mode, ac));
      res.push(row);
    }
    return res;
  }, [grid, inSz, outSz, mode, ac]);

  const hovS = hov ? out[hov.r][hov.c] : null;

  const hlSet = useMemo(() => {
    if (!hovS) return new Set<string>();
    return new Set(hovS.weights.map((w) => `${w.r},${w.c}`));
  }, [hovS]);

  const inPx = inSz <= 4 ? 52 : inSz <= 5 ? 44 : 38;
  const outPx =
    outSz <= 5 ? 48 : outSz <= 7 ? 40 : outSz <= 9 ? 34 : 30;
  const outFont = outPx <= 34 ? 9 : 11;

  return (
    <div className="not-prose my-10 rounded-2xl border border-border bg-card p-6">
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Mode</span>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-sm font-mono transition-colors ${
                  mode === m
                    ? "bg-accent text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                aria-pressed={mode === m}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            align_corners
          </span>
          <button
            onClick={() => setAc((v) => !v)}
            disabled={mode === "nearest"}
            className={`rounded-lg border px-3 py-1.5 text-sm font-mono transition-colors ${
              mode === "nearest"
                ? "cursor-not-allowed border-border text-muted-foreground/50"
                : ac
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-border text-muted-foreground hover:bg-muted"
            }`}
            aria-label="Toggle align_corners"
          >
            {mode === "nearest" ? "n/a" : ac ? "True" : "False"}
          </button>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            Input:{" "}
            <span className="font-mono text-accent">
              {inSz}&times;{inSz}
            </span>
          </span>
          <input
            type="range"
            min={2}
            max={6}
            value={inSz}
            onChange={(e) => {
              const v = +e.target.value;
              setInSz(v);
              if (outSz < v) setOutSz(v);
            }}
            className="w-28 accent-accent"
            aria-label="Input size"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            Output:{" "}
            <span className="font-mono text-accent">
              {outSz}&times;{outSz}
            </span>
          </span>
          <input
            type="range"
            min={2}
            max={10}
            value={outSz}
            onChange={(e) => setOutSz(+e.target.value)}
            className="w-28 accent-accent"
            aria-label="Output size"
          />
        </label>

        <button
          onClick={() => setSeed((s) => s + 1)}
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
            Input ({inSz}&times;{inSz})
          </span>
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `repeat(${inSz}, ${inPx}px)`,
              gridTemplateRows: `repeat(${inSz}, ${inPx}px)`,
            }}
          >
            {grid.map((row, r) =>
              row.map((val, c) => {
                const hl = hlSet.has(`${r},${c}`);
                const wt = hovS?.weights.find(
                  (w) => w.r === r && w.c === c
                );
                return (
                  <div
                    key={`${r}-${c}`}
                    className="relative flex items-center justify-center border font-mono text-xs transition-all"
                    style={{
                      width: inPx,
                      height: inPx,
                      background: hl ? HL.bg : valColor(val),
                      color: hl
                        ? "var(--foreground)"
                        : "var(--muted-foreground)",
                      fontWeight: hl ? 700 : 400,
                      borderColor: hl ? HL.border : "var(--border)",
                      borderWidth: hl ? 2 : 1,
                    }}
                  >
                    {val}
                    {hl && wt && Math.abs(wt.w) > 0.04 && (
                      <span className="absolute -right-2 -top-2 z-30 rounded-full bg-indigo-500 px-1 text-[9px] font-bold leading-[14px] text-white">
                        {wt.w < 0 ? "−" : ""}
                        {(Math.abs(wt.w) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })
            )}

            {/* Source-position dot (bilinear / bicubic only) */}
            {hovS && mode !== "nearest" && (
              <div
                className="pointer-events-none absolute z-40 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange-500"
                style={{
                  left: (hovS.srcX + 0.5) * inPx,
                  top: (hovS.srcY + 0.5) * inPx,
                }}
              />
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
            interpolate
          </span>
        </div>

        {/* Output grid */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Output ({outSz}&times;{outSz})
          </span>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${outSz}, ${outPx}px)`,
              gridTemplateRows: `repeat(${outSz}, ${outPx}px)`,
            }}
          >
            {out.map((row, r) =>
              row.map((s, c) => {
                const active = hov?.r === r && hov?.c === c;
                return (
                  <div
                    key={`${r}-${c}`}
                    className="flex cursor-pointer items-center justify-center border font-mono font-semibold transition-all"
                    style={{
                      width: outPx,
                      height: outPx,
                      fontSize: outFont,
                      background: active ? HL.bg : valColor(s.value),
                      borderColor: active ? HL.border : "var(--border)",
                      borderWidth: active ? 2 : 1,
                      color: active ? HL.border : "var(--foreground)",
                    }}
                    onMouseEnter={() => setHov({ r, c })}
                    onMouseLeave={() => setHov(null)}
                    role="gridcell"
                    aria-label={`Output ${r},${c}: ${s.value.toFixed(2)}`}
                  >
                    {s.value.toFixed(1)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <div className="mt-6 min-h-[4rem]">
        {hovS && hov ? (
          <Detail s={hovS} r={hov.r} c={hov.c} mode={mode} grid={grid} />
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Hover over an output cell to see how it&apos;s computed.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── detail panel ── */

function Detail({
  s,
  r,
  c,
  mode,
  grid,
}: {
  s: Sample;
  r: number;
  c: number;
  mode: Mode;
  grid: number[][];
}) {
  if (mode === "nearest") {
    const w0 = s.weights[0];
    return (
      <div className="rounded-lg bg-muted px-4 py-3 text-sm">
        <p className="mb-1 font-medium" style={{ color: HL.border }}>
          out[{r},{c}]
          <span className="ml-2 font-normal text-muted-foreground">
            &rarr; src ({s.srcY.toFixed(2)}, {s.srcX.toFixed(2)}) &rarr;
            floor &rarr; input[{w0.r},{w0.c}]
          </span>
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          ={" "}
          <span className="font-semibold text-foreground">
            {s.value.toFixed(1)}
          </span>
        </p>
      </div>
    );
  }

  const sorted = [...s.weights].sort(
    (a, b) => Math.abs(b.w) - Math.abs(a.w)
  );

  return (
    <div className="rounded-lg bg-muted px-4 py-3 text-sm">
      <p className="mb-1 font-medium" style={{ color: HL.border }}>
        out[{r},{c}]
        <span className="ml-2 font-normal text-muted-foreground">
          &rarr; src ({s.srcY.toFixed(2)}, {s.srcX.toFixed(2)})
        </span>
      </p>
      <p className="break-words font-mono text-xs leading-relaxed text-muted-foreground">
        ={" "}
        {sorted.map((w, i) => {
          const sign =
            w.w >= 0 ? (i > 0 ? " + " : "") : i > 0 ? " − " : "−";
          return (
            <span key={i}>
              {sign}
              {Math.abs(w.w).toFixed(2)}&middot;
              <span className="text-foreground">
                in[{w.r},{w.c}]
              </span>
              ({grid[w.r][w.c]})
            </span>
          );
        })}
        {" = "}
        <span className="font-semibold text-foreground">
          {s.value.toFixed(2)}
        </span>
      </p>
    </div>
  );
}
