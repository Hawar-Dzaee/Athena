"use client";

import { useState, useMemo, useCallback, useRef } from "react";

// ─── Layout constants ───────────────────────────────────────────
const STEM_W = 520;
const STEM_H = 200;
const STEM_PAD = { top: 12, right: 16, bottom: 32, left: 48 };
const STEM_PW = STEM_W - STEM_PAD.left - STEM_PAD.right;
const STEM_PH = STEM_H - STEM_PAD.top - STEM_PAD.bottom;

const SPEC_W = 700;
const SPEC_H = 240;
const SPEC_PAD = { top: 16, right: 20, bottom: 36, left: 52 };
const SPEC_PW = SPEC_W - SPEC_PAD.left - SPEC_PAD.right;
const SPEC_PH = SPEC_H - SPEC_PAD.top - SPEC_PAD.bottom;

const PHASOR_SIZE = 150;
const PHASOR_PAD = 25;
const PHASOR_INNER = PHASOR_SIZE - 2 * PHASOR_PAD;

const N_MIN = 16;
const N_MAX = 64;

// ─── Signal definitions ─────────────────────────────────────────
interface Signal {
  id: string;
  label: string;
  fn: (n: number, N: number) => number;
  description: string;
}

const SIGNALS: Signal[] = [
  {
    id: "cos3",
    label: "cos(2π·3n/N)",
    fn: (n, N) => Math.cos((2 * Math.PI * 3 * n) / N),
    description: "Pure cosine at bin k = 3 — expect one sharp peak",
  },
  {
    id: "sum-cos",
    label: "cos(2π·2n/N) + 0.5·cos(2π·7n/N)",
    fn: (n, N) =>
      Math.cos((2 * Math.PI * 2 * n) / N) +
      0.5 * Math.cos((2 * Math.PI * 7 * n) / N),
    description: "Two frequencies — peaks at k = 2 and k = 7",
  },
  {
    id: "impulse",
    label: "δ[n]",
    fn: (n) => (n === 0 ? 1 : 0),
    description: "Impulse at n = 0 — flat spectrum, every frequency equally present",
  },
  {
    id: "rect",
    label: "rect[n],  n < N/4",
    fn: (n, N) => (n < N / 4 ? 1 : 0),
    description: "Rectangular window — sinc-like spectrum with sidelobes",
  },
  {
    id: "exp-decay",
    label: "0.85ⁿ",
    fn: (n) => Math.pow(0.85, n),
    description: "Exponential decay — smooth low-pass spectrum",
  },
];

// ─── Scale factories ────────────────────────────────────────────
function xScaleFn(
  xMin: number,
  xMax: number,
  padLeft: number,
  plotW: number,
) {
  return (x: number) => padLeft + ((x - xMin) / (xMax - xMin)) * plotW;
}

function yScaleFn(
  yMin: number,
  yMax: number,
  padTop: number,
  plotH: number,
) {
  return (y: number) =>
    padTop + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
}

// ─── Component ──────────────────────────────────────────────────
export function DFTExplorer() {
  const [signalId, setSignalId] = useState("cos3");
  const [N, setN] = useState(16);
  const [k, setK] = useState(3);
  const specRef = useRef<SVGSVGElement>(null);

  const maxK = Math.floor(N / 2);
  const safeK = Math.min(k, maxK);

  const signal = useMemo(
    () => SIGNALS.find((s) => s.id === signalId)!,
    [signalId],
  );

  // ── Generate samples ──────────────────────────────────────────
  const samples = useMemo(() => {
    const x: number[] = [];
    for (let n = 0; n < N; n++) x.push(signal.fn(n, N));
    return x;
  }, [signal, N]);

  // ── Product stems: x[n]·cos(2πkn/N) and x[n]·sin(2πkn/N) ───
  const { cosProd, sinProd, yMinProd, yMaxProd } = useMemo(() => {
    const cosProd: number[] = [];
    const sinProd: number[] = [];
    let lo = 0;
    let hi = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * safeK * n) / N;
      const cv = samples[n] * Math.cos(angle);
      const sv = samples[n] * Math.sin(angle);
      cosProd.push(cv);
      sinProd.push(sv);
      lo = Math.min(lo, cv, sv);
      hi = Math.max(hi, cv, sv);
    }
    const pad = Math.max((hi - lo) * 0.12, 0.15);
    return {
      cosProd,
      sinProd,
      yMinProd: lo - pad,
      yMaxProd: hi + pad,
    };
  }, [samples, N, safeK]);

  // ── Current X[k] at the selected bin ──────────────────────────
  const xk = useMemo(() => {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * safeK * n) / N;
      re += samples[n] * Math.cos(angle);
      im -= samples[n] * Math.sin(angle);
    }
    const mag = Math.sqrt(re * re + im * im);
    return { re, im, mag };
  }, [samples, N, safeK]);

  // ── Full magnitude spectrum ───────────────────────────────────
  const { specBins, specMags, specMax } = useMemo(() => {
    const bins: number[] = [];
    const mags: number[] = [];
    let mx = 0;
    for (let ki = 0; ki <= maxK; ki++) {
      bins.push(ki);
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * ki * n) / N;
        re += samples[n] * Math.cos(angle);
        im -= samples[n] * Math.sin(angle);
      }
      const m = Math.sqrt(re * re + im * im);
      mags.push(m);
      mx = Math.max(mx, m);
    }
    return {
      specBins: bins,
      specMags: mags,
      specMax: Math.max(mx * 1.1, 0.1),
    };
  }, [samples, N, maxK]);

  // ── Scales ────────────────────────────────────────────────────
  const stemXScale = useMemo(
    () => xScaleFn(0, N - 1, STEM_PAD.left, STEM_PW),
    [N],
  );
  const stemYScale = useMemo(
    () => yScaleFn(yMinProd, yMaxProd, STEM_PAD.top, STEM_PH),
    [yMinProd, yMaxProd],
  );
  const specXScale = useMemo(
    () => xScaleFn(0, maxK, SPEC_PAD.left, SPEC_PW),
    [maxK],
  );
  const specYScale = useMemo(
    () => yScaleFn(0, specMax, SPEC_PAD.top, SPEC_PH),
    [specMax],
  );

  // ── Ticks ─────────────────────────────────────────────────────
  const nTicks = useMemo(() => {
    const step = N <= 16 ? 4 : N <= 32 ? 8 : 16;
    const ticks: number[] = [];
    for (let v = 0; v < N; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== N - 1) ticks.push(N - 1);
    return ticks;
  }, [N]);

  const stemYTicks = useMemo(
    () =>
      Array.from(
        { length: 5 },
        (_, i) => yMinProd + (i / 4) * (yMaxProd - yMinProd),
      ),
    [yMinProd, yMaxProd],
  );

  const specYTicks = useMemo(
    () => Array.from({ length: 5 }, (_, i) => (i / 4) * specMax),
    [specMax],
  );

  const kTicks = useMemo(() => {
    const step = maxK <= 8 ? 1 : maxK <= 16 ? 2 : 4;
    const ticks: number[] = [];
    for (let v = 0; v <= maxK; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== maxK) ticks.push(maxK);
    return ticks;
  }, [maxK]);

  // ── Spectrum pointer interaction (click + drag) ───────────────
  const updateKFromPointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = specRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * SPEC_W;
      const rawK = ((svgX - SPEC_PAD.left) / SPEC_PW) * maxK;
      setK(Math.max(0, Math.min(maxK, Math.round(rawK))));
    },
    [maxK],
  );

  // ── Phasor triangle geometry ──────────────────────────────────
  const phasor = useMemo(() => {
    const absRe = Math.abs(xk.re);
    const absIm = Math.abs(xk.im);
    const maxLeg = Math.max(absRe, absIm, 0.01);
    const scale = PHASOR_INNER / maxLeg;
    return { reLen: absRe * scale, imLen: absIm * scale };
  }, [xk.re, xk.im]);

  const zeroY = stemYScale(0);
  const barW = Math.max(2, Math.min(40, (SPEC_PW / (maxK + 1)) * 0.7));
  const stemR = N <= 24 ? 3 : N <= 40 ? 2.5 : 2;
  const stemStroke = N <= 24 ? 2 : 1.5;

  // ── Render helper: stem-plot SVG internals ────────────────────
  function StemPlotSvg(props: {
    values: number[];
    strokeClass: string;
    fillClass: string;
  }) {
    return (
      <svg
        viewBox={`0 0 ${STEM_W} ${STEM_H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Stem plot"
      >
        {/* Zero line */}
        <line
          x1={STEM_PAD.left}
          x2={STEM_W - STEM_PAD.right}
          y1={zeroY}
          y2={zeroY}
          className="stroke-foreground/20"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        {/* Stems */}
        {props.values.map((v, n) => {
          const x = stemXScale(n);
          const yVal = stemYScale(v);
          return (
            <g key={n}>
              <line
                x1={x}
                x2={x}
                y1={zeroY}
                y2={yVal}
                className={props.strokeClass}
                strokeWidth={stemStroke}
              />
              <circle
                cx={x}
                cy={yVal}
                r={stemR}
                className={props.fillClass}
              />
            </g>
          );
        })}
        {/* X axis */}
        <line
          x1={STEM_PAD.left}
          x2={STEM_W - STEM_PAD.right}
          y1={STEM_H - STEM_PAD.bottom}
          y2={STEM_H - STEM_PAD.bottom}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        {nTicks.map((v) => (
          <g key={v}>
            <line
              x1={stemXScale(v)}
              x2={stemXScale(v)}
              y1={STEM_H - STEM_PAD.bottom}
              y2={STEM_H - STEM_PAD.bottom + 5}
              className="stroke-foreground/40"
            />
            <text
              x={stemXScale(v)}
              y={STEM_H - STEM_PAD.bottom + 18}
              textAnchor="middle"
              className="fill-foreground/60 text-[10px]"
            >
              {v}
            </text>
          </g>
        ))}
        {/* Y axis */}
        <line
          x1={STEM_PAD.left}
          x2={STEM_PAD.left}
          y1={STEM_PAD.top}
          y2={STEM_H - STEM_PAD.bottom}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        {stemYTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={STEM_PAD.left - 4}
              x2={STEM_PAD.left}
              y1={stemYScale(v)}
              y2={stemYScale(v)}
              className="stroke-foreground/40"
            />
            <text
              x={STEM_PAD.left - 7}
              y={stemYScale(v) + 3}
              textAnchor="end"
              className="fill-foreground/60 text-[9px]"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={STEM_W / 2}
          y={STEM_H - 2}
          textAnchor="middle"
          className="fill-foreground/50 text-[11px]"
        >
          n
        </text>
      </svg>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Controls ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground/70">
              x[n] =
            </span>
            <select
              value={signalId}
              onChange={(e) => setSignalId(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              aria-label="Select signal function"
            >
              {SIGNALS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-sm text-muted-foreground italic">
          {signal.description}
        </p>

        <div className="flex flex-wrap gap-6">
          <label className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium text-foreground/70">
              N = {N}
            </span>
            <input
              type="range"
              min={N_MIN}
              max={N_MAX}
              step={1}
              value={N}
              onChange={(e) => setN(Number(e.target.value))}
              className="w-44 accent-indigo-400"
              aria-label="Number of samples N"
            />
          </label>
          <label className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium text-foreground/70">
              k = {safeK}
            </span>
            <input
              type="range"
              min={0}
              max={maxK}
              step={1}
              value={safeK}
              onChange={(e) => setK(Number(e.target.value))}
              className="w-44 accent-amber-400"
              aria-label="Frequency bin k"
            />
          </label>
        </div>
      </div>

      {/* ─── Stem plots ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cosine product */}
        <div className="rounded-xl border border-border bg-card p-3">
          <h4 className="text-sm font-semibold text-center mb-1">
            <span className="text-indigo-400">x[n] · cos(2πkn/N)</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Sum ={" "}
              <span className="text-indigo-400 font-semibold">
                {xk.re.toFixed(3)}
              </span>
            </span>
          </h4>
          <StemPlotSvg
            values={cosProd}
            strokeClass="stroke-indigo-400"
            fillClass="fill-indigo-400"
          />
        </div>

        {/* Sine product */}
        <div className="rounded-xl border border-border bg-card p-3">
          <h4 className="text-sm font-semibold text-center mb-1">
            <span className="text-rose-400">x[n] · sin(2πkn/N)</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              −Sum ={" "}
              <span className="text-rose-400 font-semibold">
                {xk.im.toFixed(3)}
              </span>
            </span>
          </h4>
          <StemPlotSvg
            values={sinProd}
            strokeClass="stroke-rose-400"
            fillClass="fill-rose-400"
          />
        </div>
      </div>

      {/* ─── Reconciliation ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-center gap-8">
        {/* Computed values */}
        <div className="flex flex-col gap-1.5 text-sm font-mono">
          <div>
            <span className="text-muted-foreground">Re{"{"}X[k]{"}"}</span>{" "}
            <span className="text-foreground/40">=</span>{" "}
            <span className="text-indigo-400 font-semibold">
              {xk.re.toFixed(3)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Im{"{"}X[k]{"}"}</span>{" "}
            <span className="text-foreground/40">=</span>{" "}
            <span className="text-rose-400 font-semibold">
              {xk.im.toFixed(3)}
            </span>
          </div>
          <div className="border-t border-border pt-1.5 mt-0.5">
            <span className="text-muted-foreground">|X[k]|</span>{" "}
            <span className="text-foreground/40">=</span>{" "}
            <span className="text-foreground/50">√(</span>
            <span className="text-indigo-400">
              {Math.abs(xk.re).toFixed(3)}
            </span>
            <span className="text-foreground/50">² + </span>
            <span className="text-rose-400">
              {Math.abs(xk.im).toFixed(3)}
            </span>
            <span className="text-foreground/50">²) = </span>
            <span className="text-amber-400 font-bold">
              {xk.mag.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Phasor triangle */}
        <svg
          viewBox={`0 0 ${PHASOR_SIZE} ${PHASOR_SIZE}`}
          className="w-32 h-32 shrink-0"
          role="img"
          aria-label={`Phasor: Re=${xk.re.toFixed(2)}, Im=${xk.im.toFixed(2)}, |X|=${xk.mag.toFixed(2)}`}
        >
          {/* Axes */}
          <line
            x1={PHASOR_PAD}
            x2={PHASOR_SIZE - PHASOR_PAD}
            y1={PHASOR_SIZE - PHASOR_PAD}
            y2={PHASOR_SIZE - PHASOR_PAD}
            className="stroke-foreground/15"
            strokeWidth={1}
          />
          <line
            x1={PHASOR_PAD}
            x2={PHASOR_PAD}
            y1={PHASOR_SIZE - PHASOR_PAD}
            y2={PHASOR_PAD}
            className="stroke-foreground/15"
            strokeWidth={1}
          />
          <text
            x={PHASOR_SIZE - PHASOR_PAD + 2}
            y={PHASOR_SIZE - PHASOR_PAD + 12}
            className="fill-foreground/35 text-[9px]"
          >
            Re
          </text>
          <text
            x={PHASOR_PAD - 2}
            y={PHASOR_PAD - 5}
            textAnchor="middle"
            className="fill-foreground/35 text-[9px]"
          >
            Im
          </text>

          {/* Re leg (horizontal dashed) */}
          <line
            x1={PHASOR_PAD}
            x2={PHASOR_PAD + phasor.reLen}
            y1={PHASOR_SIZE - PHASOR_PAD}
            y2={PHASOR_SIZE - PHASOR_PAD}
            className="stroke-indigo-400"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
          {/* Im leg (vertical dashed) */}
          <line
            x1={PHASOR_PAD + phasor.reLen}
            x2={PHASOR_PAD + phasor.reLen}
            y1={PHASOR_SIZE - PHASOR_PAD}
            y2={PHASOR_SIZE - PHASOR_PAD - phasor.imLen}
            className="stroke-rose-400"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
          {/* Magnitude vector (hypotenuse) */}
          <line
            x1={PHASOR_PAD}
            x2={PHASOR_PAD + phasor.reLen}
            y1={PHASOR_SIZE - PHASOR_PAD}
            y2={PHASOR_SIZE - PHASOR_PAD - phasor.imLen}
            className="stroke-amber-400"
            strokeWidth={2.5}
          />
          <circle
            cx={PHASOR_PAD + phasor.reLen}
            cy={PHASOR_SIZE - PHASOR_PAD - phasor.imLen}
            r={3}
            className="fill-amber-400"
          />
        </svg>

        <p className="text-xs text-muted-foreground max-w-48 leading-relaxed">
          Each bar in the spectrum below is one such magnitude — computed for
          every frequency bin k.
        </p>
      </div>

      {/* ─── Magnitude spectrum (bar chart) ───────────────── */}
      <div className="rounded-xl border border-border bg-card p-3">
        <h4 className="text-sm font-semibold text-center mb-1">
          <span className="text-amber-400">|X[k]|</span>
          <span className="text-muted-foreground font-normal">
            {" "}
            — Magnitude Spectrum
          </span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (click or drag to set k)
          </span>
        </h4>
        <svg
          ref={specRef}
          viewBox={`0 0 ${SPEC_W} ${SPEC_H}`}
          className="w-full overflow-visible cursor-pointer"
          role="img"
          aria-label="Magnitude spectrum — click or drag to change k"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            updateKFromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0) updateKFromPointer(e);
          }}
        >
          {/* Bars */}
          {specBins.map((ki, idx) => {
            const cx = specXScale(ki);
            const y0 = specYScale(0);
            const yTop = specYScale(specMags[idx]);
            const isSelected = ki === safeK;
            return (
              <rect
                key={ki}
                x={cx - barW / 2}
                y={yTop}
                width={barW}
                height={Math.max(0, y0 - yTop)}
                className={isSelected ? "fill-amber-400" : "fill-amber-500/30"}
                rx={1}
              />
            );
          })}

          {/* Selected bin marker */}
          <line
            x1={specXScale(safeK)}
            x2={specXScale(safeK)}
            y1={SPEC_PAD.top}
            y2={SPEC_H - SPEC_PAD.bottom}
            className="stroke-foreground/40"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <circle
            cx={specXScale(safeK)}
            cy={specYScale(xk.mag)}
            r={5}
            className="fill-amber-400 stroke-background"
            strokeWidth={2}
          />
          <text
            x={specXScale(safeK)}
            y={SPEC_PAD.top - 4}
            textAnchor="middle"
            className="fill-foreground/70 text-[10px] font-medium"
          >
            k = {safeK}
          </text>

          {/* X axis */}
          <line
            x1={SPEC_PAD.left}
            x2={SPEC_W - SPEC_PAD.right}
            y1={SPEC_H - SPEC_PAD.bottom}
            y2={SPEC_H - SPEC_PAD.bottom}
            className="stroke-foreground/30"
            strokeWidth={1}
          />
          {kTicks.map((v) => (
            <g key={v}>
              <line
                x1={specXScale(v)}
                x2={specXScale(v)}
                y1={SPEC_H - SPEC_PAD.bottom}
                y2={SPEC_H - SPEC_PAD.bottom + 5}
                className="stroke-foreground/40"
              />
              <text
                x={specXScale(v)}
                y={SPEC_H - SPEC_PAD.bottom + 18}
                textAnchor="middle"
                className="fill-foreground/60 text-[10px]"
              >
                {v}
              </text>
            </g>
          ))}

          {/* Y axis */}
          <line
            x1={SPEC_PAD.left}
            x2={SPEC_PAD.left}
            y1={SPEC_PAD.top}
            y2={SPEC_H - SPEC_PAD.bottom}
            className="stroke-foreground/30"
            strokeWidth={1}
          />
          {specYTicks.map((v, i) => (
            <g key={i}>
              <line
                x1={SPEC_PAD.left - 4}
                x2={SPEC_PAD.left}
                y1={specYScale(v)}
                y2={specYScale(v)}
                className="stroke-foreground/40"
              />
              <text
                x={SPEC_PAD.left - 7}
                y={specYScale(v) + 3}
                textAnchor="end"
                className="fill-foreground/60 text-[9px]"
              >
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text
            x={SPEC_W / 2}
            y={SPEC_H - 2}
            textAnchor="middle"
            className="fill-foreground/50 text-[11px]"
          >
            k
          </text>
          <text
            x={14}
            y={SPEC_H / 2}
            textAnchor="middle"
            transform={`rotate(-90, 14, ${SPEC_H / 2})`}
            className="fill-foreground/50 text-[11px]"
          >
            |X[k]|
          </text>
        </svg>
      </div>
    </div>
  );
}
