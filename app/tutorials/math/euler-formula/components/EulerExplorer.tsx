"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const TAU = 2 * Math.PI;
const SIZE = 360;
const CENTER = SIZE / 2;
const RADIUS = 140;

interface Preset {
  label: string;
  latex: string;
  coeff: number;
  thetaMax: number;
  thetaLabel: string;
}

const PRESETS: Preset[] = [
  {
    label: "e^(iθ)",
    latex: "e^{i\\theta}",
    coeff: 1,
    thetaMax: TAU,
    thetaLabel: "θ ∈ [0, 2π]",
  },
  {
    label: "e^(2πiθ)",
    latex: "e^{2\\pi i\\theta}",
    coeff: TAU,
    thetaMax: 1,
    thetaLabel: "θ ∈ [0, 1]",
  },
  {
    label: "e^(2iθ)",
    latex: "e^{2i\\theta}",
    coeff: 2,
    thetaMax: TAU,
    thetaLabel: "θ ∈ [0, 2π]",
  },
  {
    label: "e^(3iθ)",
    latex: "e^{3i\\theta}",
    coeff: 3,
    thetaMax: TAU,
    thetaLabel: "θ ∈ [0, 2π]",
  },
];

export function EulerExplorer() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [theta, setTheta] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  const preset = PRESETS[presetIdx];
  const angle = preset.coeff * theta;
  const cosVal = Math.cos(angle);
  const sinVal = Math.sin(angle);

  const px = CENTER + RADIUS * cosVal;
  const py = CENTER - RADIUS * sinVal;

  if (playing || trailRef.current.length > 0) {
    const last = trailRef.current[trailRef.current.length - 1];
    if (!last || Math.hypot(last.x - px, last.y - py) > 1) {
      trailRef.current.push({ x: px, y: py });
    }
  }

  const animate = useCallback(
    (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setTheta((prev) => {
        const speed = preset.thetaMax / 4;
        const next = prev + dt * speed;
        if (next >= preset.thetaMax) {
          setPlaying(false);
          return preset.thetaMax;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(animate);
    },
    [preset.thetaMax]
  );

  useEffect(() => {
    if (playing) {
      lastTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    } else if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, animate]);

  function handlePlay() {
    trailRef.current = [];
    setTheta(0);
    setPlaying(true);
  }

  function handlePresetChange(idx: number) {
    setPlaying(false);
    trailRef.current = [];
    setTheta(0);
    setPresetIdx(idx);
  }

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPlaying(false);
    trailRef.current = [];
    setTheta(parseFloat(e.target.value));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setPlaying(false);
      trailRef.current = [];
      setTheta(Math.max(0, Math.min(preset.thetaMax, val)));
    }
  }

  const trailPath =
    trailRef.current.length > 1
      ? `M ${trailRef.current[0].x} ${trailRef.current[0].y} ` +
        trailRef.current
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(" ")
      : "";

  const effectiveAngle = angle % TAU;

  return (
    <div className="flex flex-col items-center gap-6 my-8">
      {/* Formula selector */}
      <div className="flex flex-wrap justify-center gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => handlePresetChange(i)}
            className={`px-3 py-1.5 rounded-md text-sm font-mono transition-colors ${
              i === presetIdx
                ? "bg-[#38bdf8] text-[#0f172a] font-semibold"
                : "bg-foreground/10 text-foreground/70 hover:bg-foreground/20"
            }`}
            aria-label={`Select formula ${p.label}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Range hint */}
      <p className="text-xs text-foreground/50 font-mono -mt-3">
        {preset.thetaLabel}
        {preset.coeff !== 1 && " — completes " + (preset.coeff === TAU ? "1 full circle" : `${preset.coeff} revolution${preset.coeff > 1 ? "s" : ""}`)}
      </p>

      {/* Unit circle SVG */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="border border-border rounded-lg bg-[#1e1e2e]"
        aria-label={`Unit circle showing ${preset.label} as a point`}
      >
        {/* Axes */}
        <line
          x1={0}
          y1={CENTER}
          x2={SIZE}
          y2={CENTER}
          stroke="currentColor"
          className="text-foreground/20"
          strokeWidth={1}
        />
        <line
          x1={CENTER}
          y1={0}
          x2={CENTER}
          y2={SIZE}
          stroke="currentColor"
          className="text-foreground/20"
          strokeWidth={1}
        />

        {/* Unit circle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          className="text-foreground/30"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Trail */}
        {trailPath && (
          <path
            d={trailPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {/* cos projection (horizontal) */}
        <line
          x1={CENTER}
          y1={py}
          x2={px}
          y2={py}
          stroke="#4ade80"
          strokeWidth={2}
          strokeDasharray="4 2"
        />

        {/* sin projection (vertical) */}
        <line
          x1={px}
          y1={CENTER}
          x2={px}
          y2={py}
          stroke="#f472b6"
          strokeWidth={2}
          strokeDasharray="4 2"
        />

        {/* Radius line */}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={px}
          y2={py}
          stroke="#facc15"
          strokeWidth={2}
        />

        {/* Angle arc */}
        {effectiveAngle > 0.01 && (
          <path
            d={describeArc(CENTER, CENTER, 30, 0, effectiveAngle)}
            fill="none"
            stroke="#facc15"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}

        {/* Point */}
        <circle cx={px} cy={py} r={6} fill="#38bdf8" />

        {/* Axis labels */}
        <text
          x={SIZE - 12}
          y={CENTER - 8}
          className="fill-foreground/50"
          fontSize={12}
          textAnchor="end"
        >
          Re
        </text>
        <text
          x={CENTER + 8}
          y={14}
          className="fill-foreground/50"
          fontSize={12}
        >
          Im
        </text>
      </svg>

      {/* Numeric readout */}
      <div className="grid grid-cols-3 gap-4 text-center font-mono text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-foreground/50 text-xs uppercase tracking-wide">
            θ
          </span>
          <span className="text-foreground font-semibold">
            {theta.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#4ade80] text-xs uppercase tracking-wide">
            Real (cos)
          </span>
          <span className="text-[#4ade80] font-semibold">
            {cosVal.toFixed(4)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[#f472b6] text-xs uppercase tracking-wide">
            Imag (sin)
          </span>
          <span className="text-[#f472b6] font-semibold">
            {sinVal.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        <div className="flex items-center gap-3 w-full">
          <label className="text-sm text-foreground/70 shrink-0">θ =</label>
          <input
            type="range"
            min={0}
            max={preset.thetaMax}
            step={preset.thetaMax / 600}
            value={theta}
            onChange={handleSliderChange}
            className="flex-1"
            aria-label="Theta slider"
          />
          <input
            type="number"
            min={0}
            max={preset.thetaMax}
            step={0.1}
            value={theta.toFixed(2)}
            onChange={handleInputChange}
            className="w-20 px-2 py-1 text-sm rounded border border-border bg-background text-foreground text-center"
            aria-label="Theta numeric input"
          />
        </div>

        <button
          onClick={handlePlay}
          className="px-5 py-2 rounded-md bg-[#38bdf8] text-[#0f172a] font-semibold text-sm hover:bg-[#7dd3fc] transition-colors"
          aria-label="Play animation"
        >
          {playing ? "Playing…" : "▶ Play"}
        </button>
      </div>
    </div>
  );
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const startX = cx + r * Math.cos(-startAngle);
  const startY = cy - r * Math.sin(startAngle);
  const endX = cx + r * Math.cos(-endAngle);
  const endY = cy + r * Math.sin(-endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
}
