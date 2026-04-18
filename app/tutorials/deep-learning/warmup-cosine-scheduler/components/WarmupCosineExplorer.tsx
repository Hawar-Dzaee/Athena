"use client";

import { useState, useMemo, useCallback, useRef } from "react";

const MAX_EPOCHS = 300;
const CHART_W = 720;
const CHART_H = 300;
const PAD = { top: 20, right: 20, bottom: 40, left: 60 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

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

function computeSchedule(
  baseLR: number,
  minLR: number,
  warmupStartLR: number,
  warmupEpochs: number
): number[] {
  const schedule: number[] = [];
  for (let epoch = 0; epoch <= MAX_EPOCHS; epoch++) {
    if (epoch < warmupEpochs) {
      const lr =
        warmupEpochs <= 1
          ? baseLR
          : warmupStartLR +
            epoch * (baseLR - warmupStartLR) / (warmupEpochs - 1);
      schedule.push(lr);
    } else {
      const progress =
        (epoch - warmupEpochs) / (MAX_EPOCHS - warmupEpochs);
      schedule.push(
        minLR + 0.5 * (baseLR - minLR) * (1 + Math.cos(Math.PI * progress))
      );
    }
  }
  return schedule;
}

function toX(epoch: number): number {
  return PAD.left + (epoch / MAX_EPOCHS) * PLOT_W;
}

function toY(lr: number, maxLR: number): number {
  return PAD.top + PLOT_H - (lr / maxLR) * PLOT_H;
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
          ["--tw-slider-color" as string]: color,
        }}
        ref={(el) => {
          if (el) el.style.setProperty("--thumb-color", color);
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


export function WarmupCosineExplorer() {
  const [baseLR, setBaseLR] = useState(0.003);
  const [minLR, setMinLR] = useState(0.0001);
  const [warmupStartLR, setWarmupStartLR] = useState(0.00003);
  const [warmupEpochs, setWarmupEpochs] = useState(30);
  const [hoverEpoch, setHoverEpoch] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const schedule = useMemo(
    () => computeSchedule(baseLR, minLR, warmupStartLR, warmupEpochs),
    [baseLR, minLR, warmupStartLR, warmupEpochs]
  );

  const maxLR = baseLR * 1.15;

  const linePath = useMemo(() => {
    const points = schedule.map(
      (lr, e) => `${toX(e).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`
    );
    return `M${points.join("L")}`;
  }, [schedule, maxLR]);

  const warmupAreaPath = useMemo(() => {
    const bottom = PAD.top + PLOT_H;
    const pts = schedule
      .slice(0, warmupEpochs + 1)
      .map((lr, e) => `${toX(e).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`);
    return `M${toX(0)},${bottom}L${pts.join("L")}L${toX(warmupEpochs)},${bottom}Z`;
  }, [schedule, maxLR, warmupEpochs]);

  const cosineAreaPath = useMemo(() => {
    const bottom = PAD.top + PLOT_H;
    const pts = schedule
      .slice(warmupEpochs)
      .map((lr, i) => {
        const e = warmupEpochs + i;
        return `${toX(e).toFixed(1)},${toY(lr, maxLR).toFixed(1)}`;
      });
    return `M${toX(warmupEpochs)},${bottom}L${pts.join("L")}L${toX(MAX_EPOCHS)},${bottom}Z`;
  }, [schedule, maxLR, warmupEpochs]);

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
      const epoch = Math.round(
        ((x - PAD.left) / PLOT_W) * MAX_EPOCHS
      );
      if (epoch >= 0 && epoch <= MAX_EPOCHS) {
        setHoverEpoch(epoch);
      } else {
        setHoverEpoch(null);
      }
    },
    []
  );

  const hoverLR = hoverEpoch !== null ? schedule[hoverEpoch] : null;

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
            label="base_lr"
            description="LR at the top of warmup / start of cosine decay (the peak)"
            value={baseLR}
            min={0.0005}
            max={0.01}
            step={0.0005}
            onChange={(v) => {
              setBaseLR(v);
              if (minLR >= v) setMinLR(Math.max(0, v - 0.0005));
              if (warmupStartLR >= v) setWarmupStartLR(Math.max(0, v * 0.01));
            }}
            format={(v) => v.toFixed(4)}
            color={COLORS.cosine}
          />
          <Slider
            label="min_lr"
            description="LR at the end of cosine decay (bottom of the blue curve)"
            value={minLR}
            min={0}
            max={baseLR - 0.0001}
            step={0.00005}
            onChange={setMinLR}
            format={(v) => v.toFixed(5)}
            color={COLORS.min}
          />
          <Slider
            label="warmup_start_lr"
            description="LR at the start of warmup (bottom of the yellow line)"
            value={warmupStartLR}
            min={0}
            max={baseLR - 0.0001}
            step={0.00001}
            onChange={setWarmupStartLR}
            format={(v) => v.toFixed(5)}
            color={COLORS.warmup}
          />
          <Slider
            label="warmup_epochs"
            value={warmupEpochs}
            min={0}
            max={150}
            step={1}
            onChange={setWarmupEpochs}
            format={(v) => `${v}`}
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
          onMouseLeave={() => setHoverEpoch(null)}
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
            epoch
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
          {warmupEpochs > 0 && (
            <path d={warmupAreaPath} fill={COLORS.warmupFill} />
          )}
          <path d={cosineAreaPath} fill={COLORS.cosineFill} />

          {/* Warmup boundary */}
          {warmupEpochs > 0 && (
            <line
              x1={toX(warmupEpochs)}
              x2={toX(warmupEpochs)}
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
                offset={`${warmupEpochs / MAX_EPOCHS * 100}%`}
                stopColor={COLORS.warmup}
              />
              <stop
                offset={`${warmupEpochs / MAX_EPOCHS * 100}%`}
                stopColor={COLORS.cosine}
              />
              <stop offset="100%" stopColor={COLORS.cosine} />
            </linearGradient>
          </defs>

          {/* Phase labels */}
          {warmupEpochs > 15 && (
            <text
              x={PAD.left + (toX(warmupEpochs) - PAD.left) / 2}
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
            x={toX(warmupEpochs) + (toX(MAX_EPOCHS) - toX(warmupEpochs)) / 2}
            y={PAD.top + 14}
            textAnchor="middle"
            className="text-[10px] font-medium"
            fill={COLORS.cosine}
            opacity={0.7}
          >
            cosine decay
          </text>

          {/* Hover crosshair + tooltip */}
          {hoverEpoch !== null && hoverLR !== null && (
            <>
              <line
                x1={toX(hoverEpoch)}
                x2={toX(hoverEpoch)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
              />
              <circle
                cx={toX(hoverEpoch)}
                cy={toY(hoverLR, maxLR)}
                r={4}
                fill={hoverEpoch <= warmupEpochs ? COLORS.warmup : COLORS.cosine}
                stroke="white"
                strokeWidth={1.5}
              />
              <rect
                x={Math.min(toX(hoverEpoch) + 8, CHART_W - 130)}
                y={Math.max(toY(hoverLR, maxLR) - 36, PAD.top)}
                width={120}
                height={30}
                rx={6}
                fill={COLORS.tooltip}
                opacity={0.95}
              />
              <text
                x={Math.min(toX(hoverEpoch) + 16, CHART_W - 122)}
                y={Math.max(toY(hoverLR, maxLR) - 22, PAD.top + 14)}
                className="text-[10px] font-medium"
                fill="white"
              >
                epoch {hoverEpoch} &middot; lr = {hoverLR.toFixed(6)}
              </text>
            </>
          )}
        </svg>
      </div>

    </figure>
  );
}
