"use client";

import { useState, useMemo, useCallback, useRef } from "react";

const CHART_W = 720;
const CHART_H = 300;
const PAD = { top: 20, right: 20, bottom: 40, left: 60 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

const START_FACTOR = 1e-8;

const COLORS = {
  warmup: "#f59e0b",
  cosine: "#6366f1",
  min: "#ef4444",
  grid: "rgba(128,128,128,0.15)",
  axis: "rgba(128,128,128,0.4)",
  warmupFill: "rgba(245,158,11,0.1)",
  cosineFill: "rgba(99,102,241,0.1)",
  tooltip: "#18181b",
};

/** Mirrors CosineWithWarmup exactly: LinearLR factor ramp, then
 *  CosineAnnealingLR driven by its own local step count. */
function computeSchedule(
  totalSteps: number,
  warmupSteps: number,
  baseLR: number,
  minLR: number
): number[] {
  const cosineSteps = totalSteps - warmupSteps;
  const schedule: number[] = [];
  for (let step = 0; step <= totalSteps; step++) {
    if (step < warmupSteps) {
      const factor =
        START_FACTOR + (1 - START_FACTOR) * (step / warmupSteps);
      schedule.push(baseLR * factor);
    } else {
      const local = step - warmupSteps;
      schedule.push(
        minLR +
          0.5 * (baseLR - minLR) * (1 + Math.cos(Math.PI * (local / cosineSteps)))
      );
    }
  }
  return schedule;
}

function toX(step: number, totalSteps: number): number {
  return PAD.left + (step / totalSteps) * PLOT_W;
}

function toY(lr: number, maxLR: number): number {
  return PAD.top + PLOT_H - (lr / maxLR) * PLOT_H;
}

function niceTickStep(totalSteps: number): number {
  const raw = totalSteps / 5;
  for (const c of [50, 100, 200, 250, 500, 1000]) {
    if (c >= raw) return c;
  }
  return 1000;
}

function Slider({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
  format,
  color,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {label}
          </span>
          {description && (
            <span className="text-[10px] text-[var(--color-muted-foreground)] opacity-60">
              {description}
            </span>
          )}
        </div>
        <span
          className="rounded-md px-2 py-0.5 font-mono text-xs"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, var(--color-border) ${((value - min) / (max - min)) * 100}%, var(--color-border) 100%)`,
        }}
        aria-label={label}
      />
      <style>{`
        input[aria-label="${label}"]::-webkit-slider-thumb {
          background-color: ${color};
        }
        input[aria-label="${label}"]::-moz-range-thumb {
          background-color: ${color};
          height: 16px; width: 16px; border-radius: 50%;
          border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}

export function CosineWithWarmupExplorer() {
  const [totalSteps, setTotalSteps] = useState(1000);
  const [warmupRatio, setWarmupRatio] = useState(0.1);
  const [baseLR, setBaseLR] = useState(0.003);
  const [minLR, setMinLR] = useState(0.00001);
  const [hoverStep, setHoverStep] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const warmupSteps = Math.trunc(warmupRatio * totalSteps);
  const cosineSteps = totalSteps - warmupSteps;

  const schedule = useMemo(
    () => computeSchedule(totalSteps, warmupSteps, baseLR, minLR),
    [totalSteps, warmupSteps, baseLR, minLR]
  );

  const maxLR = baseLR * 1.15;

  const linePath = useMemo(() => {
    const points = schedule.map(
      (lr, s) => `${toX(s, totalSteps).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`
    );
    return `M${points.join("L")}`;
  }, [schedule, totalSteps, maxLR]);

  const warmupAreaPath = useMemo(() => {
    if (warmupSteps === 0) return "";
    const bottom = PAD.top + PLOT_H;
    const pts = schedule
      .slice(0, warmupSteps + 1)
      .map((lr, s) => `${toX(s, totalSteps).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`);
    return `M${toX(0, totalSteps)},${bottom}L${pts.join("L")}L${toX(warmupSteps, totalSteps)},${bottom}Z`;
  }, [schedule, totalSteps, maxLR, warmupSteps]);

  const cosineAreaPath = useMemo(() => {
    const bottom = PAD.top + PLOT_H;
    const pts = schedule.slice(warmupSteps).map((lr, i) => {
      const s = warmupSteps + i;
      return `${toX(s, totalSteps).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`;
    });
    return `M${toX(warmupSteps, totalSteps)},${bottom}L${pts.join("L")}L${toX(totalSteps, totalSteps)},${bottom}Z`;
  }, [schedule, totalSteps, maxLR, warmupSteps]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxLR <= 0.005 ? 0.001 : maxLR <= 0.02 ? 0.005 : 0.01;
    for (let v = 0; v <= maxLR; v += step) {
      ticks.push(parseFloat(v.toFixed(6)));
    }
    return ticks;
  }, [maxLR]);

  const xTicks = useMemo(() => {
    const step = niceTickStep(totalSteps);
    const ticks: number[] = [];
    for (let t = 0; t <= totalSteps; t += step) ticks.push(t);
    return ticks;
  }, [totalSteps]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = CHART_W / rect.width;
      const x = (e.clientX - rect.left) * scaleX;
      const step = Math.round(((x - PAD.left) / PLOT_W) * totalSteps);
      if (step >= 0 && step <= totalSteps) {
        setHoverStep(step);
      } else {
        setHoverStep(null);
      }
    },
    [totalSteps]
  );

  const hoverLR = hoverStep !== null ? schedule[hoverStep] : null;
  const hoverInWarmup = hoverStep !== null && hoverStep < warmupSteps;

  const tooltipW = 190;
  const tooltipH = 44;

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="CosineWithWarmup schedule interactive explorer"
    >
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:gap-6">
        <div className="flex flex-1 flex-col gap-3">
          <Slider
            label="total_steps"
            description="Total number of optimizer steps in the run"
            value={totalSteps}
            min={200}
            max={2000}
            step={100}
            onChange={setTotalSteps}
            format={(v) => `${v}`}
            color={COLORS.cosine}
          />
          <Slider
            label="warmup_ratio"
            description="Fraction of total_steps spent on linear warmup"
            value={warmupRatio}
            min={0}
            max={0.5}
            step={0.01}
            onChange={setWarmupRatio}
            format={(v) => v.toFixed(2)}
            color={COLORS.warmup}
          />
          <Slider
            label="base_lr"
            description="Optimizer LR — the peak reached at the end of warmup"
            value={baseLR}
            min={0.0005}
            max={0.01}
            step={0.0005}
            onChange={(v) => {
              setBaseLR(v);
              if (minLR >= v) setMinLR(Math.max(0, v - 0.0001));
            }}
            format={(v) => v.toFixed(4)}
            color={COLORS.cosine}
          />
          <Slider
            label="min_lr"
            description="Floor reached at the end of cosine annealing (eta_min)"
            value={minLR}
            min={0}
            max={baseLR - 0.0001}
            step={0.00001}
            onChange={setMinLR}
            format={(v) => v.toFixed(5)}
            color={COLORS.min}
          />
        </div>
      </div>

      {/* Derived values — what __init__ computes from the sliders */}
      <div className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs">
        <span
          className="rounded-md px-2 py-1"
          style={{ backgroundColor: `${COLORS.warmup}20`, color: COLORS.warmup }}
        >
          warmup_steps = int({warmupRatio.toFixed(2)} × {totalSteps}) ={" "}
          {warmupSteps}
        </span>
        <span
          className="rounded-md px-2 py-1"
          style={{ backgroundColor: `${COLORS.cosine}20`, color: COLORS.cosine }}
        >
          cosine_steps = {totalSteps} − {warmupSteps} = {cosineSteps}
        </span>
        <span className="rounded-md bg-[var(--color-foreground)]/5 px-2 py-1 text-[var(--color-muted-foreground)]">
          milestones = [{warmupSteps}]
        </span>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverStep(null)}
          aria-label="Learning rate schedule chart"
        >
          {/* Grid lines */}
          {yTicks.map((v) => (
            <line
              key={`yg-${v}`}
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={toY(v, maxLR)}
              y2={toY(v, maxLR)}
              stroke={COLORS.grid}
              strokeWidth={1}
            />
          ))}
          {xTicks.map((t) => (
            <line
              key={`xg-${t}`}
              x1={toX(t, totalSteps)}
              x2={toX(t, totalSteps)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke={COLORS.grid}
              strokeWidth={1}
            />
          ))}

          {/* Axes */}
          <line
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={PAD.top + PLOT_H}
            y2={PAD.top + PLOT_H}
            stroke={COLORS.axis}
            strokeWidth={1}
          />
          <line
            x1={PAD.left}
            x2={PAD.left}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            stroke={COLORS.axis}
            strokeWidth={1}
          />

          {/* Y-axis labels */}
          {yTicks.map((v) => (
            <text
              key={`yl-${v}`}
              x={PAD.left - 8}
              y={toY(v, maxLR) + 3}
              textAnchor="end"
              className="fill-[var(--color-muted-foreground)] text-[10px]"
            >
              {v.toFixed(4)}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map((t) => (
            <text
              key={`xl-${t}`}
              x={toX(t, totalSteps)}
              y={PAD.top + PLOT_H + 20}
              textAnchor="middle"
              className="fill-[var(--color-muted-foreground)] text-[10px]"
            >
              {t}
            </text>
          ))}

          {/* Axis titles */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={CHART_H - 4}
            textAnchor="middle"
            className="fill-[var(--color-muted-foreground)] text-[11px] font-medium"
          >
            step
          </text>
          <text
            x={14}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            transform={`rotate(-90, 14, ${PAD.top + PLOT_H / 2})`}
            className="fill-[var(--color-muted-foreground)] text-[11px] font-medium"
          >
            lr
          </text>

          {/* Phase fills */}
          {warmupSteps > 0 && <path d={warmupAreaPath} fill={COLORS.warmupFill} />}
          <path d={cosineAreaPath} fill={COLORS.cosineFill} />

          {/* Milestone: where SequentialLR hands off */}
          {warmupSteps > 0 && (
            <>
              <line
                x1={toX(warmupSteps, totalSteps)}
                x2={toX(warmupSteps, totalSteps)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke={COLORS.warmup}
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={0.5}
              />
              <text
                x={toX(warmupSteps, totalSteps) + 6}
                y={PAD.top + 30}
                textAnchor="start"
                className="text-[10px] font-medium"
                fill={COLORS.warmup}
                opacity={0.7}
              >
                milestone = {warmupSteps}
              </text>
            </>
          )}

          {/* Min LR line */}
          <line
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={toY(minLR, maxLR)}
            y2={toY(minLR, maxLR)}
            stroke={COLORS.min}
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.4}
          />

          {/* Main curve */}
          <path
            d={linePath}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke="url(#cww-curve-gradient)"
          />

          {/* Gradient for curve */}
          <defs>
            <linearGradient id="cww-curve-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={COLORS.warmup} />
              <stop
                offset={`${(warmupSteps / totalSteps) * 100}%`}
                stopColor={COLORS.warmup}
              />
              <stop
                offset={`${(warmupSteps / totalSteps) * 100}%`}
                stopColor={COLORS.cosine}
              />
              <stop offset="100%" stopColor={COLORS.cosine} />
            </linearGradient>
          </defs>

          {/* Phase labels */}
          {warmupSteps / totalSteps > 0.05 && (
            <text
              x={PAD.left + (toX(warmupSteps, totalSteps) - PAD.left) / 2}
              y={PAD.top + 14}
              textAnchor="middle"
              className="text-[10px] font-medium"
              fill={COLORS.warmup}
              opacity={0.7}
            >
              LinearLR
            </text>
          )}
          <text
            x={
              toX(warmupSteps, totalSteps) +
              (toX(totalSteps, totalSteps) - toX(warmupSteps, totalSteps)) / 2
            }
            y={PAD.top + 14}
            textAnchor="middle"
            className="text-[10px] font-medium"
            fill={COLORS.cosine}
            opacity={0.7}
          >
            CosineAnnealingLR
          </text>

          {/* Hover crosshair + tooltip */}
          {hoverStep !== null && hoverLR !== null && (
            <>
              <line
                x1={toX(hoverStep, totalSteps)}
                x2={toX(hoverStep, totalSteps)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
              />
              <circle
                cx={toX(hoverStep, totalSteps)}
                cy={toY(hoverLR, maxLR)}
                r={4}
                fill={hoverInWarmup ? COLORS.warmup : COLORS.cosine}
                stroke="white"
                strokeWidth={1.5}
              />
              <rect
                x={Math.min(toX(hoverStep, totalSteps) + 8, CHART_W - tooltipW - 10)}
                y={Math.max(toY(hoverLR, maxLR) - tooltipH - 6, PAD.top)}
                width={tooltipW}
                height={tooltipH}
                rx={6}
                fill={COLORS.tooltip}
                opacity={0.95}
              />
              <text
                x={Math.min(toX(hoverStep, totalSteps) + 16, CHART_W - tooltipW - 2)}
                y={Math.max(toY(hoverLR, maxLR) - tooltipH + 10, PAD.top + 16)}
                className="text-[10px] font-medium"
                fill={hoverInWarmup ? COLORS.warmup : COLORS.cosine}
              >
                {hoverInWarmup
                  ? `LinearLR · local t = ${hoverStep} / ${warmupSteps}`
                  : `CosineAnnealingLR · local t = ${hoverStep - warmupSteps} / ${cosineSteps}`}
              </text>
              <text
                x={Math.min(toX(hoverStep, totalSteps) + 16, CHART_W - tooltipW - 2)}
                y={Math.max(toY(hoverLR, maxLR) - tooltipH + 26, PAD.top + 32)}
                className="text-[10px] font-medium"
                fill="white"
              >
                step {hoverStep} &middot; lr = {hoverLR.toFixed(6)}
              </text>
            </>
          )}
        </svg>
      </div>
    </figure>
  );
}
