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

function makeInput(sz: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  return Array.from({ length: sz }, () =>
    Array.from({ length: sz }, () => Math.floor(rng() * 9) + 1),
  );
}

function makeKernel(sz: number, seed: number): number[][] {
  const rng = mulberry32(seed + 7777);
  return Array.from({ length: sz }, () =>
    Array.from({ length: sz }, () => Math.floor(rng() * 4) + 1),
  );
}

function getOutSize(
  inSz: number,
  kSz: number,
  s: number,
  p: number,
): number {
  return (inSz - 1) * s - 2 * p + kSz;
}

function makeStamp(
  val: number,
  ir: number,
  ic: number,
  kernel: number[][],
  kSz: number,
  s: number,
  p: number,
  outSz: number,
): number[][] {
  const g = Array.from({ length: outSz }, () => new Array(outSz).fill(0));
  for (let kr = 0; kr < kSz; kr++)
    for (let kc = 0; kc < kSz; kc++) {
      const or_ = ir * s + kr - p;
      const oc_ = ic * s + kc - p;
      if (or_ >= 0 && or_ < outSz && oc_ >= 0 && oc_ < outSz)
        g[or_][oc_] = val * kernel[kr][kc];
    }
  return g;
}

/* ── styling ── */

const PINK = "#f472b6";
const INK = "#1e293b";

/* ── main ── */

export default function ConvTranspose2dViz() {
  const [inputSize, setInputSize] = useState(2);
  const [kernelSize, setKernelSize] = useState(2);
  const [stride, setStride] = useState(1);
  const [padding, setPadding] = useState(0);
  const [seed, setSeed] = useState(42);
  const [sel, setSel] = useState({ r: 1, c: 1 });

  const maxPad = Math.min(
    kernelSize - 1,
    Math.floor(((inputSize - 1) * stride + kernelSize - 1) / 2),
  );
  const pad = Math.min(padding, maxPad);
  const oSz = getOutSize(inputSize, kernelSize, stride, pad);
  const safeSel = {
    r: Math.min(sel.r, inputSize - 1),
    c: Math.min(sel.c, inputSize - 1),
  };
  const selIdx = safeSel.r * inputSize + safeSel.c;

  const input = useMemo(() => makeInput(inputSize, seed), [inputSize, seed]);
  const kernel = useMemo(
    () => makeKernel(kernelSize, seed),
    [kernelSize, seed],
  );

  const intermediates = useMemo(() => {
    const arr: { ir: number; ic: number; grid: number[][] }[] = [];
    for (let ir = 0; ir < inputSize; ir++)
      for (let ic = 0; ic < inputSize; ic++)
        arr.push({
          ir,
          ic,
          grid: makeStamp(
            input[ir][ic],
            ir,
            ic,
            kernel,
            kernelSize,
            stride,
            pad,
            oSz,
          ),
        });
    return arr;
  }, [input, kernel, inputSize, kernelSize, stride, pad, oSz]);

  const finalGrid = useMemo(() => {
    const g = Array.from({ length: oSz }, () => new Array(oSz).fill(0));
    for (const { grid } of intermediates)
      for (let r = 0; r < oSz; r++)
        for (let c = 0; c < oSz; c++) g[r][c] += grid[r][c];
    return g;
  }, [intermediates, oSz]);

  /* cell sizing */
  const topSmall = 44;
  const topLarge = oSz <= 4 ? 44 : oSz <= 7 ? 36 : 30;
  const n = inputSize * inputSize;
  const bot = n <= 4 ? 42 : n <= 9 ? 34 : 28;
  const botFont = n <= 4 ? "text-sm" : n <= 9 ? "text-xs" : "text-[10px]";

  return (
    <div className="not-prose my-10 space-y-8 rounded-2xl border border-border bg-card p-6">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-end gap-6">
        <SliderControl
          label="Input"
          value={inputSize}
          min={2}
          max={4}
          display={`${inputSize}×${inputSize}`}
          onChange={setInputSize}
        />
        <SliderControl
          label="Kernel"
          value={kernelSize}
          min={2}
          max={3}
          display={`${kernelSize}×${kernelSize}`}
          onChange={(v) => {
            setKernelSize(v);
            if (padding >= v) setPadding(v - 1);
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
        {maxPad > 0 && (
          <SliderControl
            label="Padding"
            value={pad}
            min={0}
            max={maxPad}
            display={String(pad)}
            onChange={setPadding}
          />
        )}
        <button
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          aria-label="Reshuffle values"
        >
          Reshuffle
        </button>
      </div>

      {/* ── Formula ── */}
      <p className="text-center font-mono text-xs text-muted-foreground">
        output = ({inputSize} &minus; 1) &times; {stride} &minus; 2 &times;{" "}
        {pad} + {kernelSize} ={" "}
        <span className="font-semibold text-foreground">
          {oSz}&times;{oSz}
        </span>
      </p>

      {/* ── Equation row: Input * Filter = Intermediate [N] ── */}
      <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-6">
        <GridBox label="Input">
          <CellGrid
            data={input}
            cellPx={topSmall}
            highlight={(r, c) => r === safeSel.r && c === safeSel.c}
            onCellClick={(r, c) => setSel({ r, c })}
          />
        </GridBox>

        <Sym>*</Sym>

        <GridBox label="Filter">
          <CellGrid data={kernel} cellPx={topSmall} />
        </GridBox>

        <Sym>=</Sym>

        <GridBox label={`Intermediate ${selIdx + 1}`}>
          <CellGrid
            data={intermediates[selIdx].grid}
            cellPx={topLarge}
            highlight={(_r, _c, v) => v !== 0}
          />
        </GridBox>

        <div className="ml-6">
          <GridBox label="Final Result" bold>
            <CellGrid data={finalGrid} cellPx={topLarge} />
          </GridBox>
        </div>
      </div>

      {/* ── All intermediates ── */}
      <div className="flex flex-wrap items-start justify-center gap-y-6">
        {intermediates.map((inter, idx) => (
          <div
            key={idx}
            className="flex cursor-pointer items-center"
            onClick={() => setSel({ r: inter.ir, c: inter.ic })}
          >
            {idx > 0 && (
              <span className="mx-2 self-center text-xl font-bold text-muted-foreground">
                +
              </span>
            )}
            <GridBox
              label={`Intermediate ${idx + 1}`}
              active={idx === selIdx}
              small
            >
              <CellGrid
                data={inter.grid}
                cellPx={bot}
                fontSize={botFont}
                highlight={(_r, _c, v) => v !== 0}
              />
            </GridBox>
          </div>
        ))}
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
        {label}:{" "}
        <span className="font-mono text-accent">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 accent-accent"
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

function GridBox({
  label,
  children,
  bold,
  active,
  small,
}: {
  label: string;
  children: React.ReactNode;
  bold?: boolean;
  active?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={`${small ? "text-[10px]" : "text-xs"} font-semibold tracking-wide ${
          bold || active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <div
        style={{
          outline: active ? "2px solid var(--accent)" : "none",
          outlineOffset: "3px",
          borderRadius: 4,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function CellGrid({
  data,
  cellPx,
  fontSize = "text-sm",
  highlight,
  onCellClick,
}: {
  data: number[][];
  cellPx: number;
  fontSize?: string;
  highlight?: (r: number, c: number, val: number) => boolean;
  onCellClick?: (r: number, c: number) => void;
}) {
  const rows = data.length;
  const cols = data[0]?.length ?? 0;

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
      }}
      role="grid"
    >
      {data.map((row, r) =>
        row.map((val, c) => {
          const hl = highlight?.(r, c, val) ?? false;
          return (
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center border border-border font-mono ${fontSize} font-semibold ${onCellClick ? "cursor-pointer hover:opacity-80" : ""}`}
              style={{
                width: cellPx,
                height: cellPx,
                background: hl ? PINK : "transparent",
                color: hl ? INK : "var(--foreground)",
              }}
              onClick={onCellClick ? () => onCellClick(r, c) : undefined}
              role="gridcell"
              aria-label={`Row ${r}, column ${c}: ${val}`}
            >
              {val}
            </div>
          );
        }),
      )}
    </div>
  );
}
