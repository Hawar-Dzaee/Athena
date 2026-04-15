"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface LayerData {
  name: string;
  weightNorm: number;
  gradientNorm: number;
  params: string; // human-readable param count
}

type Mode = "sgd" | "lars";

/** Realistic layer profiles inspired by ResNet-like architectures. */
const LAYERS: LayerData[] = [
  { name: "Conv1", weightNorm: 0.8, gradientNorm: 0.02, params: "9.4K" },
  { name: "Block1", weightNorm: 3.2, gradientNorm: 0.15, params: "74K" },
  { name: "Block2", weightNorm: 5.6, gradientNorm: 0.45, params: "295K" },
  { name: "Block3", weightNorm: 12.1, gradientNorm: 1.8, params: "1.2M" },
  { name: "Block4", weightNorm: 24.3, gradientNorm: 6.2, params: "4.7M" },
  { name: "FC", weightNorm: 1.4, gradientNorm: 3.1, params: "513K" },
];

const COLORS = {
  weight: "#8b5cf6",
  gradient: "#f43f5e",
  sgdLR: "#6b7280",
  larsLR: "#10b981",
  accent: "#d946ef",
};

/* ------------------------------------------------------------------ */
/*  LARS math                                                           */
/* ------------------------------------------------------------------ */

function larsLocalLR(
  globalLR: number,
  trust: number,
  weightNorm: number,
  gradientNorm: number,
  weightDecay: number
): number {
  if (weightNorm === 0) return 0;
  const ratio = weightNorm / (gradientNorm + weightDecay * weightNorm);
  return globalLR * trust * ratio;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
          {label}
        </span>
        <span className="rounded-md bg-neutral-800 px-2 py-0.5 font-mono text-xs text-[var(--color-foreground)]">
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
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-foreground)]
          [&::-webkit-slider-thumb]:shadow-md"
        aria-label={label}
      />
    </div>
  );
}

function ModeToggle({
  mode,
  onToggle,
}: {
  mode: Mode;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${mode === "sgd" ? "LARS" : "SGD"} mode`}
      className="relative flex h-10 w-full items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-1"
    >
      <motion.div
        className="absolute h-8 w-[calc(50%-4px)] rounded-lg"
        style={{ backgroundColor: mode === "lars" ? COLORS.larsLR : COLORS.sgdLR }}
        animate={{ x: mode === "sgd" ? 4 : "calc(100% + 4px)" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
      <span
        className={`relative z-10 flex-1 text-center text-sm font-semibold transition-colors ${
          mode === "sgd" ? "text-white" : "text-[var(--color-muted-foreground)]"
        }`}
      >
        SGD
      </span>
      <span
        className={`relative z-10 flex-1 text-center text-sm font-semibold transition-colors ${
          mode === "lars" ? "text-white" : "text-[var(--color-muted-foreground)]"
        }`}
      >
        LARS
      </span>
    </button>
  );
}

function LayerBar({
  layer,
  effectiveLR,
  maxLR,
  mode,
  globalLR,
}: {
  layer: LayerData;
  effectiveLR: number;
  maxLR: number;
  mode: Mode;
  globalLR: number;
}) {
  const barPct = maxLR > 0 ? Math.min(effectiveLR / maxLR, 1) * 100 : 0;
  const ratio = layer.weightNorm / layer.gradientNorm;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      {/* Layer header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            {layer.name}
          </span>
          <span className="rounded-md bg-neutral-800 px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]">
            {layer.params}
          </span>
        </div>
        <motion.span
          key={effectiveLR.toFixed(6)}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-xs font-semibold"
          style={{ color: mode === "lars" ? COLORS.larsLR : COLORS.sgdLR }}
        >
          LR = {effectiveLR < 0.001 ? effectiveLR.toExponential(2) : effectiveLR.toFixed(4)}
        </motion.span>
      </div>

      {/* Norm stats */}
      <div className="flex gap-4 text-[11px]">
        <span className="text-[var(--color-muted-foreground)]">
          <span style={{ color: COLORS.weight }}>||w||</span> = {layer.weightNorm.toFixed(1)}
        </span>
        <span className="text-[var(--color-muted-foreground)]">
          <span style={{ color: COLORS.gradient }}>||g||</span> = {layer.gradientNorm.toFixed(2)}
        </span>
        <span className="text-[var(--color-muted-foreground)]">
          ratio = {ratio.toFixed(1)}
        </span>
      </div>

      {/* LR bar */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-800">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor: mode === "lars" ? COLORS.larsLR : COLORS.sgdLR,
          }}
          animate={{ width: `${barPct}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>

      {/* SGD flat line indicator */}
      {mode === "lars" && (
        <div className="relative h-0">
          <motion.div
            className="absolute -top-3 h-3 border-r-2 border-dashed"
            style={{
              borderColor: COLORS.sgdLR,
              left: `${Math.min(globalLR / maxLR, 1) * 100}%`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Insight text                                                        */
/* ------------------------------------------------------------------ */

function getInsight(mode: Mode, globalLR: number, trust: number): string {
  if (mode === "sgd") {
    return `Standard SGD applies the same learning rate (${globalLR.toFixed(2)}) to every layer. Early layers (small gradients) barely move, while later layers (large gradients) can overshoot. This imbalance gets worse as batch size grows — gradients scale but the flat LR can't compensate.`;
  }
  if (trust < 0.005) {
    return "With a very small trust coefficient, LARS is extremely conservative — effective LRs are tiny across the board. The model will train stably but very slowly.";
  }
  if (trust > 0.03) {
    return "A high trust coefficient makes LARS more aggressive. Per-layer scaling still prevents the worst mismatches, but individual layers may overshoot. The original paper uses φ = 0.02 for most experiments.";
  }
  return "LARS scales each layer's learning rate by the ratio ||w|| / ||g||. Layers with large weights relative to their gradients (like early convolutions) get a boost; layers where gradients dominate (like the FC head) get damped. This rebalancing is what makes large-batch training work.";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function LARSExplorer() {
  const [mode, setMode] = useState<Mode>("sgd");
  const [globalLR, setGlobalLR] = useState(0.1);
  const [trust, setTrust] = useState(0.02);
  const weightDecay = 0.0001;

  const effectiveLRs = useMemo(() => {
    if (mode === "sgd") {
      return LAYERS.map(() => globalLR);
    }
    return LAYERS.map((l) =>
      larsLocalLR(globalLR, trust, l.weightNorm, l.gradientNorm, weightDecay)
    );
  }, [mode, globalLR, trust]);

  const maxLR = useMemo(() => {
    const allVals = [
      ...effectiveLRs,
      globalLR, // include global for SGD baseline marker
    ];
    return Math.max(...allVals) * 1.1; // 10% headroom
  }, [effectiveLRs, globalLR]);

  // Spread metric: std dev of effective LRs (higher = more per-layer variation)
  const lrMean = effectiveLRs.reduce((s, v) => s + v, 0) / effectiveLRs.length;
  const lrStd = Math.sqrt(
    effectiveLRs.reduce((s, v) => s + (v - lrMean) ** 2, 0) / effectiveLRs.length
  );

  return (
    <figure
      className="my-8 lg:-mx-20 xl:-mx-32"
      role="figure"
      aria-label="LARS interactive learning rate explorer"
    >
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
        <div className="w-full sm:w-48">
          <ModeToggle mode={mode} onToggle={() => setMode((m) => (m === "sgd" ? "lars" : "sgd"))} />
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <Slider
            label="Global learning rate η"
            value={globalLR}
            min={0.01}
            max={0.5}
            step={0.01}
            onChange={setGlobalLR}
            format={(v) => v.toFixed(2)}
          />
          <AnimatePresence>
            {mode === "lars" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Slider
                  label="Trust coefficient φ"
                  value={trust}
                  min={0.001}
                  max={0.05}
                  step={0.001}
                  onChange={setTrust}
                  format={(v) => v.toFixed(3)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Layer bars */}
        <div className="flex flex-1 flex-col gap-3">
          {LAYERS.map((layer, i) => (
            <LayerBar
              key={layer.name}
              layer={layer}
              effectiveLR={effectiveLRs[i]}
              maxLR={maxLR}
              mode={mode}
              globalLR={globalLR}
            />
          ))}
        </div>

        {/* Side panel */}
        <div className="flex w-full flex-col gap-4 lg:w-72">
          {/* Summary stats */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Summary
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-muted-foreground)]">Mean LR</span>
                <span className="font-mono text-[var(--color-foreground)]">
                  {lrMean < 0.001 ? lrMean.toExponential(2) : lrMean.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted-foreground)]">Std dev</span>
                <span className="font-mono text-[var(--color-foreground)]">
                  {lrStd < 0.001 ? lrStd.toExponential(2) : lrStd.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-muted-foreground)]">Max / Min ratio</span>
                <span className="font-mono text-[var(--color-foreground)]">
                  {(Math.max(...effectiveLRs) / Math.max(Math.min(...effectiveLRs), 1e-10)).toFixed(1)}x
                </span>
              </div>
            </div>
          </div>

          {/* Insight */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              What to look for
            </h3>
            <AnimatePresence mode="wait">
              <motion.p
                key={`${mode}-${trust.toFixed(3)}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="text-sm leading-relaxed text-[var(--color-foreground)]"
              >
                {getInsight(mode, globalLR, trust)}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Legend
            </h3>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-5 rounded-full" style={{ backgroundColor: COLORS.weight }} />
                <span className="text-[var(--color-muted-foreground)]">||w|| weight norm</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-5 rounded-full" style={{ backgroundColor: COLORS.gradient }} />
                <span className="text-[var(--color-muted-foreground)]">||g|| gradient norm</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-5 rounded-full" style={{ backgroundColor: COLORS.larsLR }} />
                <span className="text-[var(--color-muted-foreground)]">LARS effective LR</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-5 rounded-full" style={{ backgroundColor: COLORS.sgdLR }} />
                <span className="text-[var(--color-muted-foreground)]">SGD flat LR</span>
              </div>
              {mode === "lars" && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-5 border-r-2 border-dashed" style={{ borderColor: COLORS.sgdLR }} />
                  <span className="text-[var(--color-muted-foreground)]">SGD baseline (for comparison)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
