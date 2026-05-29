"use client";

import { useState, useMemo, useEffect } from "react";

/* ── types ── */

type Vol = number[][][]; // [depth][row][col]

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

function makeVol(d: number, h: number, w: number, seed: number, lo: number, hi: number): Vol {
  const rng = mulberry32(seed);
  return Array.from({ length: d }, () =>
    Array.from({ length: h }, () =>
      Array.from({ length: w }, () => Math.floor(rng() * (hi - lo + 1)) + lo),
    ),
  );
}

function outDim(inSz: number, k: number, s: number, p: number): number {
  return Math.floor((inSz + 2 * p - k) / s) + 1;
}

/* in-bounds read, returns 0 for padded positions */
function at(vol: Vol, d: number, r: number, c: number): number {
  if (d < 0 || d >= vol.length) return 0;
  if (r < 0 || r >= vol[0].length) return 0;
  if (c < 0 || c >= vol[0][0].length) return 0;
  return vol[d][r][c];
}

/* ── styling ── */

const PINK = "#f472b6"; // receptive field highlight
const INK = "#1e293b";

/* ── main ── */

export default function Conv3dViz() {
  const [depth, setDepth] = useState(3);
  const [spatial, setSpatial] = useState(4); // H = W
  const [kernel, setKernel] = useState(2); // cubic kernel
  const [stride, setStride] = useState(1);
  const [padding, setPadding] = useState(0);
  const [seed, setSeed] = useState(42);
  const [sel, setSel] = useState({ d: 0, r: 0, c: 0 });
  const [playing, setPlaying] = useState(false);

  /* clamp padding so the kernel still fits */
  const maxPad = Math.max(0, kernel - 1);
  const pad = Math.min(padding, maxPad);

  const outD = Math.max(1, outDim(depth, kernel, stride, pad));
  const outH = Math.max(1, outDim(spatial, kernel, stride, pad));
  const outW = Math.max(1, outDim(spatial, kernel, stride, pad));

  const input = useMemo(
    () => makeVol(depth, spatial, spatial, seed, 0, 9),
    [depth, spatial, seed],
  );
  const weight = useMemo(
    () => makeVol(kernel, kernel, kernel, seed + 7777, -1, 2),
    [kernel, seed],
  );

  /* keep the selected output cell in range */
  const safeSel = {
    d: Math.min(sel.d, outD - 1),
    r: Math.min(sel.r, outH - 1),
    c: Math.min(sel.c, outW - 1),
  };

  /* the receptive-field origin in input coords (top-left-front corner) */
  const origin = {
    d: safeSel.d * stride - pad,
    r: safeSel.r * stride - pad,
    c: safeSel.c * stride - pad,
  };

  /* contributions for the selected output cell */
  const terms = useMemo(() => {
    const list: { kd: number; kr: number; kc: number; x: number; w: number }[] = [];
    for (let kd = 0; kd < kernel; kd++)
      for (let kr = 0; kr < kernel; kr++)
        for (let kc = 0; kc < kernel; kc++) {
          const x = at(input, origin.d + kd, origin.r + kr, origin.c + kc);
          list.push({ kd, kr, kc, x, w: weight[kd][kr][kc] });
        }
    return list;
  }, [input, weight, kernel, origin.d, origin.r, origin.c]);

  const outValue = useMemo(
    () => terms.reduce((acc, t) => acc + t.x * t.w, 0),
    [terms],
  );

  /* full output volume */
  const output = useMemo(() => {
    const g: Vol = Array.from({ length: outD }, () =>
      Array.from({ length: outH }, () => new Array(outW).fill(0)),
    );
    for (let od = 0; od < outD; od++)
      for (let oh = 0; oh < outH; oh++)
        for (let ow = 0; ow < outW; ow++) {
          let s = 0;
          for (let kd = 0; kd < kernel; kd++)
            for (let kr = 0; kr < kernel; kr++)
              for (let kc = 0; kc < kernel; kc++)
                s +=
                  at(
                    input,
                    od * stride - pad + kd,
                    oh * stride - pad + kr,
                    ow * stride - pad + kc,
                  ) * weight[kd][kr][kc];
          g[od][oh][ow] = s;
        }
    return g;
  }, [input, weight, kernel, stride, pad, outD, outH, outW]);

  /* auto-scan through every output position */
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setSel((prev) => {
        const flat =
          (prev.d * outH + prev.r) * outW + prev.c;
        const next = (flat + 1) % (outD * outH * outW);
        const c = next % outW;
        const r = Math.floor(next / outW) % outH;
        const d = Math.floor(next / (outW * outH));
        return { d, r, c };
      });
    }, 650);
    return () => clearInterval(id);
  }, [playing, outD, outH, outW]);

  /* which input cells are inside the current receptive field */
  const inField = (d: number, r: number, c: number) =>
    d >= origin.d &&
    d < origin.d + kernel &&
    r >= origin.r &&
    r < origin.r + kernel &&
    c >= origin.c &&
    c < origin.c + kernel;

  const inDepthSlices = new Set<number>();
  for (let kd = 0; kd < kernel; kd++) inDepthSlices.add(origin.d + kd);

  /* cell sizing */
  const inCell = spatial <= 4 ? 34 : spatial === 5 ? 30 : 26;
  const kCell = 30;
  const oCell = Math.max(outH, outW) <= 3 ? 36 : 30;

  return (
    <div className="not-prose my-10 space-y-8 rounded-2xl border border-border bg-card p-6">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-end gap-6">
        <SliderControl
          label="Depth"
          value={depth}
          min={2}
          max={4}
          display={String(depth)}
          onChange={setDepth}
        />
        <SliderControl
          label="H × W"
          value={spatial}
          min={3}
          max={6}
          display={`${spatial}×${spatial}`}
          onChange={setSpatial}
        />
        <SliderControl
          label="Kernel"
          value={kernel}
          min={2}
          max={3}
          display={`${kernel}³`}
          onChange={(v) => {
            setKernel(v);
            if (padding > v - 1) setPadding(v - 1);
          }}
        />
        <SliderControl
          label="Stride"
          value={stride}
          min={1}
          max={2}
          display={String(stride)}
          onChange={setStride}
        />
        <SliderControl
          label="Padding"
          value={pad}
          min={0}
          max={maxPad}
          display={String(pad)}
          onChange={setPadding}
        />
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          aria-label={playing ? "Pause scan" : "Play scan"}
        >
          {playing ? "❚❚ Pause" : "▶ Scan"}
        </button>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          aria-label="Reshuffle values"
        >
          Reshuffle
        </button>
      </div>

      {/* ── Shape formula ── */}
      <p className="text-center font-mono text-xs text-muted-foreground">
        in&nbsp;<span className="text-foreground">{depth}×{spatial}×{spatial}</span>
        &nbsp;·&nbsp;kernel&nbsp;{kernel}³&nbsp;·&nbsp;stride&nbsp;{stride}&nbsp;·&nbsp;pad&nbsp;{pad}
        &nbsp;→&nbsp;out&nbsp;
        <span className="font-semibold text-foreground">
          {outD}×{outH}×{outW}
        </span>
      </p>

      {/* ── Volumes row ── */}
      <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-6">
        {/* Input */}
        <VolumeBox label={`Input (D=${depth})`}>
          <SliceStack
            vol={input}
            cellPx={inCell}
            activeDepth={inDepthSlices}
            highlight={inField}
            depthLabel="d"
          />
        </VolumeBox>

        <Sym>*</Sym>

        {/* Kernel */}
        <VolumeBox label={`Weight (${kernel}³)`}>
          <SliceStack vol={weight} cellPx={kCell} depthLabel="k" allActive />
        </VolumeBox>

        <Sym>=</Sym>

        {/* Output */}
        <VolumeBox label={`Output (D=${outD})`}>
          <SliceStack
            vol={output}
            cellPx={oCell}
            selected={safeSel}
            onCellClick={(d, r, c) => {
              setPlaying(false);
              setSel({ d, r, c });
            }}
            depthLabel="d"
          />
        </VolumeBox>
      </div>

      {/* ── Computation for the selected cell ── */}
      <div className="rounded-xl border border-border bg-background/40 p-4">
        <p className="mb-3 text-center text-xs font-semibold tracking-wide text-muted-foreground">
          OUTPUT&nbsp;[{safeSel.d}, {safeSel.r}, {safeSel.c}] = Σ (input × weight) over the {kernel}
          ×{kernel}×{kernel} window
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5 font-mono text-xs">
          {terms.map((t, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && <span className="mx-1 text-muted-foreground">+</span>}
              <span
                className="rounded px-1.5 py-0.5"
                style={{ background: PINK, color: INK }}
              >
                {t.x}
              </span>
              <span className="mx-0.5 text-muted-foreground">·</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                {t.w}
              </span>
            </span>
          ))}
          <span className="mx-1 text-muted-foreground">=</span>
          <span className="rounded px-2 py-0.5 text-sm font-bold text-accent">
            {outValue}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SliderControl({
  label,
  value,
  min,
  max,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-foreground">
        {label}: <span className="font-mono text-accent">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 accent-accent"
        aria-label={label}
      />
    </label>
  );
}

function Sym({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-center text-2xl font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function VolumeBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/* A stack of depth slices, drawn front-to-back as a row of grids. */
function SliceStack({
  vol,
  cellPx,
  activeDepth,
  allActive,
  highlight,
  selected,
  onCellClick,
  depthLabel = "d",
}: {
  vol: Vol;
  cellPx: number;
  activeDepth?: Set<number>;
  allActive?: boolean;
  highlight?: (d: number, r: number, c: number) => boolean;
  selected?: { d: number; r: number; c: number };
  onCellClick?: (d: number, r: number, c: number) => void;
  depthLabel?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {vol.map((slice, d) => {
        const active = allActive || activeDepth?.has(d) || selected?.d === d;
        return (
          <div key={d} className="flex flex-col items-center gap-1">
            <div
              style={{
                outline: active ? "2px solid var(--accent)" : "none",
                outlineOffset: "2px",
                borderRadius: 4,
                opacity: active ? 1 : 0.5,
                transition: "opacity 150ms, outline-color 150ms",
              }}
            >
              <SliceGrid
                slice={slice}
                d={d}
                cellPx={cellPx}
                highlight={highlight}
                selected={selected?.d === d ? selected : undefined}
                onCellClick={onCellClick}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {depthLabel}={d}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SliceGrid({
  slice,
  d,
  cellPx,
  highlight,
  selected,
  onCellClick,
}: {
  slice: number[][];
  d: number;
  cellPx: number;
  highlight?: (d: number, r: number, c: number) => boolean;
  selected?: { d: number; r: number; c: number };
  onCellClick?: (d: number, r: number, c: number) => void;
}) {
  const rows = slice.length;
  const cols = slice[0]?.length ?? 0;
  const fontSize = cellPx <= 28 ? "text-[11px]" : "text-sm";

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
      }}
      role="grid"
    >
      {slice.map((row, r) =>
        row.map((val, c) => {
          const hl = highlight?.(d, r, c) ?? false;
          const isSel =
            selected && selected.r === r && selected.c === c;
          return (
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center border border-border font-mono ${fontSize} font-semibold ${onCellClick ? "cursor-pointer hover:opacity-80" : ""}`}
              style={{
                width: cellPx,
                height: cellPx,
                background: hl ? PINK : "transparent",
                color: hl ? INK : "var(--foreground)",
                outline: isSel ? "2px solid var(--accent)" : "none",
                outlineOffset: "-2px",
              }}
              onClick={onCellClick ? () => onCellClick(d, r, c) : undefined}
              role="gridcell"
              aria-label={`Depth ${d}, row ${r}, column ${c}: ${val}`}
            >
              {val}
            </div>
          );
        }),
      )}
    </div>
  );
}
