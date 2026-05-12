"use client";

import { useState, useMemo, useCallback, useRef } from "react";

// ─── Layout constants ───────────────────────────────────────────
const PROD_W = 520;
const PROD_H = 200;
const PROD_PAD = { top: 12, right: 16, bottom: 32, left: 48 };
const PROD_PW = PROD_W - PROD_PAD.left - PROD_PAD.right;
const PROD_PH = PROD_H - PROD_PAD.top - PROD_PAD.bottom;

const SPEC_W = 700;
const SPEC_H = 240;
const SPEC_PAD = { top: 16, right: 20, bottom: 36, left: 52 };
const SPEC_PW = SPEC_W - SPEC_PAD.left - SPEC_PAD.right;
const SPEC_PH = SPEC_H - SPEC_PAD.top - SPEC_PAD.bottom;

const PHASOR_SIZE = 150;
const PHASOR_PAD = 25;
const PHASOR_INNER = PHASOR_SIZE - 2 * PHASOR_PAD;

const OMEGA_MAX = 12;
const N_SPECTRUM = 300;
const N_PRODUCT = 400;
const N_INT = 600;

// ─── Signal definitions ─────────────────────────────────────────
interface Signal {
  id: string;
  label: string;
  fn: (t: number) => number;
  description: string;
}

const SIGNALS: Signal[] = [
  {
    id: "cos3",
    label: "cos(3t)",
    fn: (t) => Math.cos(3 * t),
    description: "Pure cosine — expect a sharp peak at ω = 3",
  },
  {
    id: "sum-cos",
    label: "cos(2t) + 0.5·cos(7t)",
    fn: (t) => Math.cos(2 * t) + 0.5 * Math.cos(7 * t),
    description: "Two superposed frequencies — peaks at ω = 2 and ω = 7",
  },
  {
    id: "gaussian",
    label: "exp(−t²/2)",
    fn: (t) => Math.exp(-(t * t) / 2),
    description: "Smooth Gaussian pulse — produces a smooth, wide spectrum",
  },
  {
    id: "rect",
    label: "rect(t),  |t| ≤ 1",
    fn: (t) => (Math.abs(t) <= 1 ? 1 : 0),
    description: "Sharp rectangular pulse — sinc-shaped spectrum with ripples",
  },
  {
    id: "exp-decay",
    label: "exp(−|t|)",
    fn: (t) => Math.exp(-Math.abs(t)),
    description: "Double exponential — smooth Lorentzian spectrum",
  },
];

// ─── Numerical integration (trapezoidal rule) ───────────────────
function trapIntegrate(
  f: (t: number) => number,
  tMin: number,
  tMax: number,
  omega: number,
  mode: "cos" | "sin",
): number {
  const dt = (tMax - tMin) / N_INT;
  let sum = 0;
  for (let i = 0; i <= N_INT; i++) {
    const t = tMin + i * dt;
    const kernel =
      mode === "cos" ? Math.cos(omega * t) : Math.sin(omega * t);
    const val = f(t) * kernel;
    sum += i === 0 || i === N_INT ? val * 0.5 : val;
  }
  return sum * dt;
}

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

// ─── Path builders ──────────────────────────────────────────────
function buildCurvePath(
  xs: number[],
  ys: number[],
  sx: (n: number) => number,
  sy: (n: number) => number,
): string {
  let d = "";
  for (let i = 0; i < xs.length; i++) {
    d += `${i === 0 ? "M" : "L"}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`;
  }
  return d;
}

function buildAreaPath(
  xs: number[],
  ys: number[],
  sx: (n: number) => number,
  sy: (n: number) => number,
  baseline: number,
): string {
  const b = sy(baseline).toFixed(1);
  let d = `M${sx(xs[0]).toFixed(1)},${b}`;
  for (let i = 0; i < xs.length; i++) {
    d += `L${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`;
  }
  d += `L${sx(xs[xs.length - 1]).toFixed(1)},${b}Z`;
  return d;
}

// ─── Component ──────────────────────────────────────────────────
export function FourierExplorer() {
  const [signalId, setSignalId] = useState("cos3");
  const [tRange, setTRange] = useState(4);
  const [omega, setOmega] = useState(3);
  const specRef = useRef<SVGSVGElement>(null);

  const signal = useMemo(
    () => SIGNALS.find((s) => s.id === signalId)!,
    [signalId],
  );

  // ── Product curves: f(t)·cos(ωt) and f(t)·sin(ωt) ───────────
  const { ts, cosProd, sinProd, yMinProd, yMaxProd } = useMemo(() => {
    const ts: number[] = [];
    const cosProd: number[] = [];
    const sinProd: number[] = [];
    let lo = 0;
    let hi = 0;
    for (let i = 0; i <= N_PRODUCT; i++) {
      const t = -tRange + (i / N_PRODUCT) * 2 * tRange;
      ts.push(t);
      const cv = signal.fn(t) * Math.cos(omega * t);
      const sv = signal.fn(t) * Math.sin(omega * t);
      cosProd.push(cv);
      sinProd.push(sv);
      lo = Math.min(lo, cv, sv);
      hi = Math.max(hi, cv, sv);
    }
    const pad = Math.max((hi - lo) * 0.12, 0.15);
    return {
      ts,
      cosProd,
      sinProd,
      yMinProd: lo - pad,
      yMaxProd: hi + pad,
    };
  }, [signal, tRange, omega]);

  // ── Current F(ω) at the selected omega ────────────────────────
  const ft = useMemo(() => {
    const re = trapIntegrate(signal.fn, -tRange, tRange, omega, "cos");
    const im = -trapIntegrate(signal.fn, -tRange, tRange, omega, "sin");
    const mag = Math.sqrt(re * re + im * im);
    return { re, im, mag };
  }, [signal, tRange, omega]);

  // ── Full magnitude spectrum ───────────────────────────────────
  const { specOmegas, specMags, specMax } = useMemo(() => {
    const omegas: number[] = [];
    const mags: number[] = [];
    let mx = 0;
    for (let i = 0; i <= N_SPECTRUM; i++) {
      const w = (i / N_SPECTRUM) * OMEGA_MAX;
      omegas.push(w);
      const re = trapIntegrate(signal.fn, -tRange, tRange, w, "cos");
      const im = -trapIntegrate(signal.fn, -tRange, tRange, w, "sin");
      const m = Math.sqrt(re * re + im * im);
      mags.push(m);
      mx = Math.max(mx, m);
    }
    return {
      specOmegas: omegas,
      specMags: mags,
      specMax: Math.max(mx * 1.1, 0.1),
    };
  }, [signal, tRange]);

  // ── Scales ────────────────────────────────────────────────────
  const prodXScale = useMemo(
    () => xScaleFn(-tRange, tRange, PROD_PAD.left, PROD_PW),
    [tRange],
  );
  const prodYScale = useMemo(
    () => yScaleFn(yMinProd, yMaxProd, PROD_PAD.top, PROD_PH),
    [yMinProd, yMaxProd],
  );
  const specXScale = useMemo(
    () => xScaleFn(0, OMEGA_MAX, SPEC_PAD.left, SPEC_PW),
    [],
  );
  const specYScale = useMemo(
    () => yScaleFn(0, specMax, SPEC_PAD.top, SPEC_PH),
    [specMax],
  );

  // ── Paths ─────────────────────────────────────────────────────
  const cosAreaD = useMemo(
    () => buildAreaPath(ts, cosProd, prodXScale, prodYScale, 0),
    [ts, cosProd, prodXScale, prodYScale],
  );
  const cosCurveD = useMemo(
    () => buildCurvePath(ts, cosProd, prodXScale, prodYScale),
    [ts, cosProd, prodXScale, prodYScale],
  );
  const sinAreaD = useMemo(
    () => buildAreaPath(ts, sinProd, prodXScale, prodYScale, 0),
    [ts, sinProd, prodXScale, prodYScale],
  );
  const sinCurveD = useMemo(
    () => buildCurvePath(ts, sinProd, prodXScale, prodYScale),
    [ts, sinProd, prodXScale, prodYScale],
  );
  const specAreaD = useMemo(
    () => buildAreaPath(specOmegas, specMags, specXScale, specYScale, 0),
    [specOmegas, specMags, specXScale, specYScale],
  );
  const specCurveD = useMemo(
    () => buildCurvePath(specOmegas, specMags, specXScale, specYScale),
    [specOmegas, specMags, specXScale, specYScale],
  );

  // ── Ticks ─────────────────────────────────────────────────────
  const tTicks = useMemo(() => {
    const step = tRange <= 2 ? 1 : tRange <= 5 ? 2 : 4;
    const ticks: number[] = [];
    for (let v = -tRange; v <= tRange + 0.001; v += step)
      ticks.push(Math.round(v * 10) / 10);
    return ticks;
  }, [tRange]);

  const prodYTicks = useMemo(
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

  const omegaTicks = [0, 2, 4, 6, 8, 10, 12];

  // ── Spectrum pointer interaction (click + drag) ───────────────
  const updateOmegaFromPointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = specRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * SPEC_W;
      const w = ((svgX - SPEC_PAD.left) / SPEC_PW) * OMEGA_MAX;
      setOmega(Math.max(0, Math.min(OMEGA_MAX, Math.round(w * 10) / 10)));
    },
    [],
  );

  // ── Phasor triangle geometry ──────────────────────────────────
  const phasor = useMemo(() => {
    const absRe = Math.abs(ft.re);
    const absIm = Math.abs(ft.im);
    const maxLeg = Math.max(absRe, absIm, 0.01);
    const scale = PHASOR_INNER / maxLeg;
    return { reLen: absRe * scale, imLen: absIm * scale };
  }, [ft.re, ft.im]);

  const zeroY = prodYScale(0);

  // ── Render helper: product-plot SVG internals ─────────────────
  function ProductPlotSvg(props: {
    areaD: string;
    curveD: string;
    areaClass: string;
    curveClass: string;
  }) {
    return (
      <svg
        viewBox={`0 0 ${PROD_W} ${PROD_H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Product plot"
      >
        {/* Zero line */}
        <line
          x1={PROD_PAD.left}
          x2={PROD_W - PROD_PAD.right}
          y1={zeroY}
          y2={zeroY}
          className="stroke-foreground/20"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        {/* Shaded area */}
        <path d={props.areaD} className={props.areaClass} />
        {/* Curve */}
        <path
          d={props.curveD}
          fill="none"
          className={props.curveClass}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* X axis */}
        <line
          x1={PROD_PAD.left}
          x2={PROD_W - PROD_PAD.right}
          y1={PROD_H - PROD_PAD.bottom}
          y2={PROD_H - PROD_PAD.bottom}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        {tTicks.map((v) => (
          <g key={v}>
            <line
              x1={prodXScale(v)}
              x2={prodXScale(v)}
              y1={PROD_H - PROD_PAD.bottom}
              y2={PROD_H - PROD_PAD.bottom + 5}
              className="stroke-foreground/40"
            />
            <text
              x={prodXScale(v)}
              y={PROD_H - PROD_PAD.bottom + 18}
              textAnchor="middle"
              className="fill-foreground/60 text-[10px]"
            >
              {v}
            </text>
          </g>
        ))}
        {/* Y axis */}
        <line
          x1={PROD_PAD.left}
          x2={PROD_PAD.left}
          y1={PROD_PAD.top}
          y2={PROD_H - PROD_PAD.bottom}
          className="stroke-foreground/30"
          strokeWidth={1}
        />
        {prodYTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PROD_PAD.left - 4}
              x2={PROD_PAD.left}
              y1={prodYScale(v)}
              y2={prodYScale(v)}
              className="stroke-foreground/40"
            />
            <text
              x={PROD_PAD.left - 7}
              y={prodYScale(v) + 3}
              textAnchor="end"
              className="fill-foreground/60 text-[9px]"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={PROD_W / 2}
          y={PROD_H - 2}
          textAnchor="middle"
          className="fill-foreground/50 text-[11px]"
        >
          t
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
              f(t) =
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
              T range: [−{tRange}, {tRange}]
            </span>
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={tRange}
              onChange={(e) => setTRange(Number(e.target.value))}
              className="w-44 accent-indigo-400"
              aria-label="Integration range T"
            />
          </label>
          <label className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium text-foreground/70">
              ω = {omega.toFixed(1)}
            </span>
            <input
              type="range"
              min={0}
              max={OMEGA_MAX}
              step={0.1}
              value={omega}
              onChange={(e) => setOmega(Number(e.target.value))}
              className="w-44 accent-amber-400"
              aria-label="Angular frequency omega"
            />
          </label>
        </div>
      </div>

      {/* ─── Product plots ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cosine product */}
        <div className="rounded-xl border border-border bg-card p-3">
          <h4 className="text-sm font-semibold text-center mb-1">
            <span className="text-indigo-400">f(t) · cos(ωt)</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Area ={" "}
              <span className="text-indigo-400 font-semibold">
                {ft.re.toFixed(3)}
              </span>
            </span>
          </h4>
          <ProductPlotSvg
            areaD={cosAreaD}
            curveD={cosCurveD}
            areaClass="fill-indigo-500/20"
            curveClass="stroke-indigo-400"
          />
        </div>

        {/* Sine product */}
        <div className="rounded-xl border border-border bg-card p-3">
          <h4 className="text-sm font-semibold text-center mb-1">
            <span className="text-rose-400">f(t) · sin(ωt)</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              −Area ={" "}
              <span className="text-rose-400 font-semibold">
                {ft.im.toFixed(3)}
              </span>
            </span>
          </h4>
          <ProductPlotSvg
            areaD={sinAreaD}
            curveD={sinCurveD}
            areaClass="fill-rose-500/20"
            curveClass="stroke-rose-400"
          />
        </div>
      </div>

      {/* ─── Reconciliation ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-center gap-8">
        {/* Computed values */}
        <div className="flex flex-col gap-1.5 text-sm font-mono">
          <div>
            <span className="text-muted-foreground">Re{"{"}F(ω){"}"}</span>{" "}
            <span className="text-foreground/40">=</span>{" "}
            <span className="text-indigo-400 font-semibold">
              {ft.re.toFixed(3)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Im{"{"}F(ω){"}"}</span>{" "}
            <span className="text-foreground/40">=</span>{" "}
            <span className="text-rose-400 font-semibold">
              {ft.im.toFixed(3)}
            </span>
          </div>
          <div className="border-t border-border pt-1.5 mt-0.5">
            <span className="text-muted-foreground">|F(ω)|</span>{" "}
            <span className="text-foreground/40">=</span>{" "}
            <span className="text-foreground/50">√(</span>
            <span className="text-indigo-400">{Math.abs(ft.re).toFixed(3)}</span>
            <span className="text-foreground/50">² + </span>
            <span className="text-rose-400">{Math.abs(ft.im).toFixed(3)}</span>
            <span className="text-foreground/50">²) = </span>
            <span className="text-amber-400 font-bold">
              {ft.mag.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Phasor triangle */}
        <svg
          viewBox={`0 0 ${PHASOR_SIZE} ${PHASOR_SIZE}`}
          className="w-32 h-32 shrink-0"
          role="img"
          aria-label={`Phasor: Re=${ft.re.toFixed(2)}, Im=${ft.im.toFixed(2)}, |F|=${ft.mag.toFixed(2)}`}
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
          Each point on the spectrum below is one such magnitude — computed for
          every ω across the range.
        </p>
      </div>

      {/* ─── Magnitude spectrum ───────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-3">
        <h4 className="text-sm font-semibold text-center mb-1">
          <span className="text-amber-400">|F(ω)|</span>
          <span className="text-muted-foreground font-normal">
            {" "}
            — Magnitude Spectrum
          </span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (click or drag to set ω)
          </span>
        </h4>
        <svg
          ref={specRef}
          viewBox={`0 0 ${SPEC_W} ${SPEC_H}`}
          className="w-full overflow-visible cursor-crosshair"
          role="img"
          aria-label="Magnitude spectrum — click or drag to change omega"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            updateOmegaFromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0) updateOmegaFromPointer(e);
          }}
        >
          {/* Area fill */}
          <path d={specAreaD} className="fill-amber-500/15" />
          {/* Curve */}
          <path
            d={specCurveD}
            fill="none"
            className="stroke-amber-400"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* Current ω marker */}
          <line
            x1={specXScale(omega)}
            x2={specXScale(omega)}
            y1={SPEC_PAD.top}
            y2={SPEC_H - SPEC_PAD.bottom}
            className="stroke-foreground/40"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <circle
            cx={specXScale(omega)}
            cy={specYScale(ft.mag)}
            r={5}
            className="fill-amber-400 stroke-background"
            strokeWidth={2}
          />
          <text
            x={specXScale(omega)}
            y={SPEC_PAD.top - 4}
            textAnchor="middle"
            className="fill-foreground/70 text-[10px] font-medium"
          >
            ω = {omega.toFixed(1)}
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
          {omegaTicks.map((v) => (
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
            ω
          </text>
          <text
            x={14}
            y={SPEC_H / 2}
            textAnchor="middle"
            transform={`rotate(-90, 14, ${SPEC_H / 2})`}
            className="fill-foreground/50 text-[11px]"
          >
            |F(ω)|
          </text>
        </svg>
      </div>
    </div>
  );
}
