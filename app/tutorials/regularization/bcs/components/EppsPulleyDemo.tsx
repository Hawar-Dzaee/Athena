"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

const N_PTS = 12;
const W = 500;
const H = 440;
const M = 44;

const LINE_Y = 50;
const DATA_DOMAIN: [number, number] = [-4, 4];

const PLOT_TOP = 125;
const PLOT_BOTTOM = H - M;
const T_DOMAIN: [number, number] = [-3, 3];
const CF_RANGE: [number, number] = [-0.4, 1.15];
const N_FREQ = 80;

const COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#22d3ee",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxMuller(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

type Preset = "gaussian" | "collapsed" | "bimodal" | "uniform";

function makePoints(preset: Preset): number[] {
  const rng = mulberry32(42);
  switch (preset) {
    case "gaussian":
      return Array.from({ length: N_PTS }, () => boxMuller(rng));
    case "collapsed":
      return Array.from({ length: N_PTS }, () => (rng() - 0.5) * 0.15);
    case "bimodal":
      return Array.from({ length: N_PTS }, (_, i) =>
        (i < N_PTS / 2 ? -1.8 : 1.8) + (rng() - 0.5) * 0.5,
      );
    case "uniform":
      return Array.from({ length: N_PTS }, () => (rng() - 0.5) * 6);
  }
}

function computeEP(points: number[]) {
  const n = points.length;
  const tStep = (T_DOMAIN[1] - T_DOMAIN[0]) / (N_FREQ - 1);
  const tValues = Array.from({ length: N_FREQ }, (_, i) => T_DOMAIN[0] + i * tStep);

  const gaussianCF = tValues.map((t) => Math.exp(-0.5 * t * t));

  const ecfReal: number[] = [];
  const ecfImag: number[] = [];
  for (const t of tValues) {
    let cosSum = 0;
    let sinSum = 0;
    for (const xi of points) {
      cosSum += Math.cos(t * xi);
      sinSum += Math.sin(t * xi);
    }
    ecfReal.push(cosSum / n);
    ecfImag.push(sinSum / n);
  }

  const errValues = tValues.map((_, i) => {
    const dr = ecfReal[i] - gaussianCF[i];
    const di = ecfImag[i];
    return gaussianCF[i] * (dr * dr + di * di);
  });

  let integral = 0;
  for (let i = 1; i < tValues.length; i++) {
    const dt = tValues[i] - tValues[i - 1];
    integral += (errValues[i - 1] + errValues[i]) * 0.5 * dt;
  }

  return { tValues, gaussianCF, ecfReal, ecfImag, statistic: integral };
}

function buildPath(
  tValues: number[],
  yValues: number[],
  tScale: d3.ScaleLinear<number, number>,
  cfScale: d3.ScaleLinear<number, number>,
): string {
  return tValues
    .map(
      (t, i) =>
        `${i === 0 ? "M" : "L"}${tScale(t).toFixed(2)},${cfScale(yValues[i]).toFixed(2)}`,
    )
    .join(" ");
}

export function EppsPulleyDemo() {
  const [points, setPoints] = useState<number[]>(() => makePoints("gaussian"));
  const [dragging, setDragging] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const xScale = useMemo(
    () => d3.scaleLinear().domain(DATA_DOMAIN).range([M, W - M]),
    [],
  );
  const tScale = useMemo(
    () => d3.scaleLinear().domain(T_DOMAIN).range([M, W - M]),
    [],
  );
  const cfScale = useMemo(
    () => d3.scaleLinear().domain(CF_RANGE).range([PLOT_BOTTOM, PLOT_TOP]),
    [],
  );

  const ep = useMemo(() => computeEP(points), [points]);

  const dataStats = useMemo(() => {
    const mean = points.reduce((s, v) => s + v, 0) / points.length;
    const variance =
      points.reduce((s, v) => s + (v - mean) ** 2, 0) / (points.length - 1);
    return { mean, std: Math.sqrt(variance) };
  }, [points]);

  const svgToDataX = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const svgPt = pt.matrixTransform(ctm.inverse());
      return Math.max(
        DATA_DOMAIN[0],
        Math.min(DATA_DOMAIN[1], xScale.invert(svgPt.x)),
      );
    },
    [xScale],
  );

  const onDown = useCallback(
    (i: number) => (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      setDragging(i);
    },
    [],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (dragging === null) return;
      const x = svgToDataX(e);
      if (x === null) return;
      setPoints((prev) => prev.map((v, i) => (i === dragging ? x : v)));
    },
    [dragging, svgToDataX],
  );

  const onUp = useCallback(() => setDragging(null), []);

  const gaussianPath = useMemo(
    () => buildPath(ep.tValues, ep.gaussianCF, tScale, cfScale),
    [ep, tScale, cfScale],
  );
  const ecfRealPath = useMemo(
    () => buildPath(ep.tValues, ep.ecfReal, tScale, cfScale),
    [ep, tScale, cfScale],
  );
  const ecfImagPath = useMemo(
    () => buildPath(ep.tValues, ep.ecfImag, tScale, cfScale),
    [ep, tScale, cfScale],
  );

  const tGridLines = [-3, -2, -1, 0, 1, 2, 3];
  const cfGridValues = [0, 0.5, 1.0];
  const numberLineTicks = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="Epps-Pulley test interactive demo"
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            role="img"
            aria-label="Number line and characteristic function comparison"
          >
            <defs>
              <clipPath id="ep-cf-clip">
                <rect
                  x={M}
                  y={PLOT_TOP}
                  width={W - 2 * M}
                  height={PLOT_BOTTOM - PLOT_TOP}
                />
              </clipPath>
            </defs>

            {/* === Number line section === */}
            <text
              x={W / 2}
              y={22}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="var(--color-foreground)"
            >
              Data samples
            </text>

            <line
              x1={xScale(DATA_DOMAIN[0])}
              y1={LINE_Y}
              x2={xScale(DATA_DOMAIN[1])}
              y2={LINE_Y}
              stroke="var(--color-border)"
              strokeWidth={1.5}
            />

            {numberLineTicks.map((v) => (
              <g key={`tick-${v}`}>
                <line
                  x1={xScale(v)}
                  y1={LINE_Y - 5}
                  x2={xScale(v)}
                  y2={LINE_Y + 5}
                  stroke="var(--color-border)"
                  strokeWidth={v === 0 ? 1.5 : 0.75}
                  opacity={v === 0 ? 0.7 : 0.4}
                />
                <text
                  x={xScale(v)}
                  y={LINE_Y + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-muted-foreground)"
                >
                  {v}
                </text>
              </g>
            ))}

            {points.map((v, i) => (
              <circle
                key={`pt-${i}`}
                cx={xScale(v)}
                cy={LINE_Y}
                r={7}
                fill={COLORS[i]}
                stroke="white"
                strokeWidth={1.5}
                opacity={0.9}
                cursor="ew-resize"
                onPointerDown={onDown(i)}
                style={{ touchAction: "none" }}
              />
            ))}

            {/* Separator */}
            <line
              x1={M}
              y1={95}
              x2={W - M}
              y2={95}
              stroke="var(--color-border)"
              strokeWidth={0.5}
              opacity={0.3}
            />

            {/* === CF Plot section === */}
            <text
              x={W / 2}
              y={PLOT_TOP - 15}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="var(--color-foreground)"
            >
              Characteristic function comparison
            </text>

            {/* Grid */}
            {tGridLines.map((v) => (
              <line
                key={`tg-${v}`}
                x1={tScale(v)}
                y1={PLOT_TOP}
                x2={tScale(v)}
                y2={PLOT_BOTTOM}
                stroke="var(--color-border)"
                strokeWidth={v === 0 ? 1 : 0.5}
                opacity={v === 0 ? 0.5 : 0.15}
              />
            ))}
            {cfGridValues.map((v) => (
              <g key={`cg-${v}`}>
                <line
                  x1={M}
                  y1={cfScale(v)}
                  x2={W - M}
                  y2={cfScale(v)}
                  stroke="var(--color-border)"
                  strokeWidth={v === 0 ? 1 : 0.5}
                  opacity={v === 0 ? 0.5 : 0.15}
                />
                <text
                  x={M - 8}
                  y={cfScale(v) + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--color-muted-foreground)"
                >
                  {v.toFixed(1)}
                </text>
              </g>
            ))}

            {/* CF lines (clipped) */}
            <g clipPath="url(#ep-cf-clip)">
              <path
                d={gaussianPath}
                fill="none"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                opacity={0.8}
              />
              <path
                d={ecfRealPath}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2}
              />
              <path
                d={ecfImagPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            </g>

            {/* X-axis label */}
            <text
              x={W / 2}
              y={PLOT_BOTTOM + 30}
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-muted-foreground)"
            >
              frequency t
            </text>

            {/* Legend */}
            <g transform={`translate(${M + 8}, ${PLOT_TOP + 8})`}>
              <rect
                x={-6}
                y={-6}
                width={185}
                height={62}
                rx={8}
                fill="var(--color-background)"
                fillOpacity={0.9}
                stroke="var(--color-border)"
                strokeWidth={0.5}
              />
              <line
                x1={0}
                y1={8}
                x2={20}
                y2={8}
                stroke="#10b981"
                strokeWidth={2.5}
                strokeDasharray="6 4"
              />
              <text
                x={26}
                y={12}
                fontSize="10"
                fill="var(--color-muted-foreground)"
              >
                {"Gaussian CF  exp(−t²/2)"}
              </text>
              <line
                x1={0}
                y1={26}
                x2={20}
                y2={26}
                stroke="#6366f1"
                strokeWidth={2}
              />
              <text
                x={26}
                y={30}
                fontSize="10"
                fill="var(--color-muted-foreground)"
              >
                {"ECF real  Re 𝔼[eⁱᵗˣ]"}
              </text>
              <line
                x1={0}
                y1={44}
                x2={20}
                y2={44}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
              <text
                x={26}
                y={48}
                fontSize="10"
                fill="var(--color-muted-foreground)"
              >
                {"ECF imag  Im 𝔼[eⁱᵗˣ]"}
              </text>
            </g>
          </svg>
        </div>

        {/* Stats panel */}
        <div className="flex w-full flex-col gap-4 lg:w-64">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Epps–Pulley Statistic
            </h3>
            <div
              className="font-mono text-2xl font-bold transition-colors duration-200"
              style={{ color: ep.statistic > 0.1 ? "#ef4444" : "#10b981" }}
            >
              {ep.statistic.toFixed(4)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
              {"∫ φ(t) · |φ̂(t) − φ(t)|² dt"}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Data Statistics
            </h3>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-muted-foreground)]">mean</span>
              <span className="font-mono">{dataStats.mean.toFixed(3)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-[var(--color-muted-foreground)]">std</span>
              <span className="font-mono">{dataStats.std.toFixed(3)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["Gaussian", "gaussian"],
                ["Collapsed", "collapsed"],
                ["Bimodal", "bimodal"],
                ["Uniform", "uniform"],
              ] as const
            ).map(([label, key]) => (
              <button
                key={key}
                onClick={() => setPoints(makePoints(key))}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-border)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
