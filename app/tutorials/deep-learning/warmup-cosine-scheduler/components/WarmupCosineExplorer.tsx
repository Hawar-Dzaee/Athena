"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TOTAL_STEPS = 300;
const CHART_W = 720;
const CHART_H = 300;
const PAD = { top: 20, right: 20, bottom: 40, left: 60 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

const COLORS = {
  warmup: "#f59e0b",
  cosine: "#6366f1",
  min: "#ef4444",
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.25)",
  warmupFill: "rgba(245,158,11,0.08)",
  cosineFill: "rgba(99,102,241,0.08)",
  tooltip: "#18181b",
};

function computeSchedule(
  peakLR: number,
  minLR: number,
  warmupFrac: number
): number[] {
  const warmupSteps = Math.round(warmupFrac * TOTAL_STEPS);
  const schedule: number[] = [];
  for (let t = 0; t <= TOTAL_STEPS; t++) {
    if (t <= warmupSteps) {
      schedule.push(warmupSteps === 0 ? peakLR : peakLR * (t / warmupSteps));
    } else {
      const progress = (t - warmupSteps) / (TOTAL_STEPS - warmupSteps);
      schedule.push(
        minLR + 0.5 * (peakLR - minLR) * (1 + Math.cos(Math.PI * progress))
      );
    }
  }
  return schedule;
}

function toX(step: number): number {
  return PAD.left + (step / TOTAL_STEPS) * PLOT_W;
}

function toY(lr: number, maxLR: number): number {
  return PAD.top + PLOT_H - (lr / maxLR) * PLOT_H;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  color,
}: {
  label: string;
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
        <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
          {label}
        </span>
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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-700
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
        style={
          {
            "--tw-slider-color": color,
          } as React.CSSProperties
        }
        aria-label={label}
      />
    </div>
  );
}

function getInsight(warmupFrac: number, peakLR: number, minLR: number): string {
  if (warmupFrac === 0) {
    return "No warmup — the learning rate starts at the peak immediately. This works for fine-tuning pre-trained models but risks instability when training from scratch, since early gradients are noisy and optimizer statistics are uninitialized.";
  }
  if (warmupFrac > 0.3) {
    return "A long warmup phase — over 30% of training is spent ramping up. This is very conservative. Unless you're using extremely large batch sizes (8K+), this wastes training capacity on sub-optimal learning rates.";
  }
  if (minLR / peakLR > 0.3) {
    return "The minimum LR is a large fraction of the peak — the schedule is relatively flat. The cosine shape is barely visible. This behaves more like a constant learning rate with a warmup prefix.";
  }
  if (peakLR > 0.008) {
    return "A high peak learning rate. The warmup ramp is especially important here — without it, the first few steps at this LR would likely cause gradient spikes or divergence. The cosine decay helps the optimizer settle into a good minimum by the end.";
  }
  return "A typical warmup cosine schedule. The LR ramps linearly during warmup, stays near the peak through the productive middle phase, then decays smoothly. Most of the learning happens in the region between 50–80% of training.";
}

export function WarmupCosineExplorer() {
  const [peakLR, setPeakLR] = useState(0.003);
  const [minLR, setMinLR] = useState(0.0001);
  const [warmupFrac, setWarmupFrac] = useState(0.1);
  const [hoverStep, setHoverStep] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const schedule = useMemo(
    () => computeSchedule(peakLR, minLR, warmupFrac),
    [peakLR, minLR, warmupFrac]
  );

  const maxLR = peakLR * 1.15;
  const warmupSteps = Math.round(warmupFrac * TOTAL_STEPS);

  const linePath = useMemo(() => {
    const points = schedule.map(
      (lr, t) => `${toX(t).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`
    );
    return `M${points.join("L")}`;
  }, [schedule, maxLR]);

  const warmupAreaPath = useMemo(() => {
    const bottom = PAD.top + PLOT_H;
    const pts = schedule
      .slice(0, warmupSteps + 1)
      .map((lr, t) => `${toX(t).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`);
    return `M${toX(0)},${bottom}L${pts.join("L")}L${toX(warmupSteps)},${bottom}Z`;
  }, [schedule, maxLR, warmupSteps]);

  const cosineAreaPath = useMemo(() => {
    const bottom = PAD.top + PLOT_H;
    const pts = schedule
      .slice(warmupSteps)
      .map((lr, i) => {
        const t = warmupSteps + i;
        return `${toX(t).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`;
      });
    return `M${toX(warmupSteps)},${bottom}L${pts.join("L")}L${toX(TOTAL_STEPS)},${bottom}Z`;
  }, [schedule, maxLR, warmupSteps]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxLR <= 0.005 ? 0.001 : maxLR <= 0.02 ? 0.005 : 0.01;
    for (let v = 0; v <= maxLR; v += step) {
      ticks.push(parseFloat(v.toFixed(6)));
    }
    return ticks;
  }, [maxLR]);

  const xTicks = [0, 50, 100, 150, 200, 250, 300];

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = CHART_W / rect.width;
      const x = (e.clientX - rect.left) * scaleX;
      const step = Math.round(
        ((x - PAD.left) / PLOT_W) * TOTAL_STEPS
      );
      if (step >= 0 && step <= TOTAL_STEPS) {
        setHoverStep(step);
      } else {
        setHoverStep(null);
      }
    },
    []
  );

  const hoverLR = hoverStep !== null ? schedule[hoverStep] : null;

  return (
    <figure
      className="my-8"
      role="figure"
      aria-label="Warmup cosine schedule interactive explorer"
    >
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:gap-6">
        <div className="flex flex-1 flex-col gap-3">
          <Slider
            label="Peak learning rate"
            value={peakLR}
            min={0.0005}
            max={0.01}
            step={0.0005}
            onChange={(v) => {
              setPeakLR(v);
              if (minLR >= v) setMinLR(Math.max(0, v - 0.0005));
            }}
            format={(v) => v.toFixed(4)}
            color={COLORS.cosine}
          />
          <Slider
            label="Minimum learning rate"
            value={minLR}
            min={0}
            max={peakLR - 0.0001}
            step={0.00005}
            onChange={setMinLR}
            format={(v) => v.toFixed(5)}
            color={COLORS.min}
          />
          <Slider
            label="Warmup fraction"
            value={warmupFrac}
            min={0}
            max={0.5}
            step={0.01}
            onChange={setWarmupFrac}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            color={COLORS.warmup}
          />
        </div>
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
              x1={toX(t)}
              x2={toX(t)}
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
              x={toX(t)}
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
            Training step
          </text>
          <text
            x={14}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            transform={`rotate(-90, 14, ${PAD.top + PLOT_H / 2})`}
            className="fill-[var(--color-muted-foreground)] text-[11px] font-medium"
          >
            Learning rate
          </text>

          {/* Phase fills */}
          {warmupSteps > 0 && (
            <path d={warmupAreaPath} fill={COLORS.warmupFill} />
          )}
          <path d={cosineAreaPath} fill={COLORS.cosineFill} />

          {/* Warmup boundary */}
          {warmupSteps > 0 && (
            <line
              x1={toX(warmupSteps)}
              x2={toX(warmupSteps)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke={COLORS.warmup}
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.5}
            />
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
            stroke="url(#curve-gradient)"
          />

          {/* Gradient for curve */}
          <defs>
            <linearGradient id="curve-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={COLORS.warmup} />
              <stop
                offset={`${warmupFrac * 100}%`}
                stopColor={COLORS.warmup}
              />
              <stop
                offset={`${warmupFrac * 100}%`}
                stopColor={COLORS.cosine}
              />
              <stop offset="100%" stopColor={COLORS.cosine} />
            </linearGradient>
          </defs>

          {/* Phase labels */}
          {warmupSteps > 15 && (
            <text
              x={PAD.left + (toX(warmupSteps) - PAD.left) / 2}
              y={PAD.top + 14}
              textAnchor="middle"
              className="text-[10px] font-medium"
              fill={COLORS.warmup}
              opacity={0.7}
            >
              warmup
            </text>
          )}
          <text
            x={toX(warmupSteps) + (toX(TOTAL_STEPS) - toX(warmupSteps)) / 2}
            y={PAD.top + 14}
            textAnchor="middle"
            className="text-[10px] font-medium"
            fill={COLORS.cosine}
            opacity={0.7}
          >
            cosine decay
          </text>

          {/* Hover crosshair + tooltip */}
          {hoverStep !== null && hoverLR !== null && (
            <>
              <line
                x1={toX(hoverStep)}
                x2={toX(hoverStep)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
              />
              <circle
                cx={toX(hoverStep)}
                cy={toY(hoverLR, maxLR)}
                r={4}
                fill={hoverStep <= warmupSteps ? COLORS.warmup : COLORS.cosine}
                stroke="white"
                strokeWidth={1.5}
              />
              <rect
                x={Math.min(toX(hoverStep) + 8, CHART_W - 130)}
                y={Math.max(toY(hoverLR, maxLR) - 36, PAD.top)}
                width={120}
                height={30}
                rx={6}
                fill={COLORS.tooltip}
                opacity={0.95}
              />
              <text
                x={Math.min(toX(hoverStep) + 16, CHART_W - 122)}
                y={Math.max(toY(hoverLR, maxLR) - 22, PAD.top + 14)}
                className="text-[10px] font-medium"
                fill="white"
              >
                step {hoverStep} &middot; LR = {hoverLR.toFixed(6)}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Info panels */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        {/* Stats */}
        <div className="flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Schedule stats
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-[var(--color-muted-foreground)] text-xs">
                Warmup steps
              </span>
              <span className="font-mono text-[var(--color-foreground)]">
                {warmupSteps} / {TOTAL_STEPS}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[var(--color-muted-foreground)] text-xs">
                Peak LR
              </span>
              <span className="font-mono" style={{ color: COLORS.cosine }}>
                {peakLR.toFixed(4)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[var(--color-muted-foreground)] text-xs">
                Min LR
              </span>
              <span className="font-mono" style={{ color: COLORS.min }}>
                {minLR.toFixed(5)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[var(--color-muted-foreground)] text-xs">
                Decay ratio
              </span>
              <span className="font-mono text-[var(--color-foreground)]">
                {peakLR > 0 ? (minLR / peakLR * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Insight */}
        <div className="flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            What to look for
          </h3>
          <AnimatePresence mode="wait">
            <motion.p
              key={`${warmupFrac}-${peakLR}-${minLR}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-sm leading-relaxed text-[var(--color-foreground)]"
            >
              {getInsight(warmupFrac, peakLR, minLR)}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 lg:w-56">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Legend
          </h3>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-5 rounded-full"
                style={{ backgroundColor: COLORS.warmup }}
              />
              <span className="text-[var(--color-muted-foreground)]">
                Warmup phase
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-5 rounded-full"
                style={{ backgroundColor: COLORS.cosine }}
              />
              <span className="text-[var(--color-muted-foreground)]">
                Cosine decay phase
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-0 w-5 border-t-2 border-dashed"
                style={{ borderColor: COLORS.min }}
              />
              <span className="text-[var(--color-muted-foreground)]">
                Minimum LR
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-0 w-5 border-t-2 border-dashed"
                style={{ borderColor: COLORS.warmup }}
              />
              <span className="text-[var(--color-muted-foreground)]">
                Warmup boundary
              </span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
