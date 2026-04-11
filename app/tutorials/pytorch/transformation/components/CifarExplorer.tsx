"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import cifar from "../data/cifar10-samples.json";
import TransformChatBot from "./TransformChatBot";

interface Sample {
  index: number;
  label: number;
  className: string;
  image: string;
}

const samples = cifar.samples as Sample[];
const classes = cifar.classes as string[];

type TransformName = "RandomResizedCrop" | "ColorJitter" | "Grayscale" | "Solarize" | "HorizontalFlip";
const ALL_TRANSFORMS: TransformName[] = ["RandomResizedCrop", "ColorJitter", "Grayscale", "Solarize", "HorizontalFlip"];

/* ── Main component ────────────────────────────────────────────────── */

export default function CifarExplorer() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [enabled, setEnabled] = useState<TransformName[]>([]);

  // RandomResizedCrop params
  const [outputSize, setOutputSize] = useState(32);
  const [scaleMin, setScaleMin] = useState(0.08);
  const [scaleMax, setScaleMax] = useState(1.0);

  // ColorJitter params
  const [cjBrightness, setCjBrightness] = useState(0.4);
  const [cjContrast, setCjContrast] = useState(0.4);
  const [cjSaturation, setCjSaturation] = useState(0.2);
  const [cjHue, setCjHue] = useState(0.1);

  // Grayscale params
  const [gsChannels, setGsChannels] = useState<1 | 3>(1);

  // Solarize params (transforms.functional)
  const [solarizeThreshold, setSolarizeThreshold] = useState(128);

  // Transform result
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(
    () =>
      filterClass === "all"
        ? samples
        : samples.filter((s) => s.className === filterClass),
    [filterClass],
  );

  const safeIndex = Math.min(selectedIndex, filtered.length - 1);
  if (safeIndex !== selectedIndex) {
    setSelectedIndex(safeIndex);
  }

  const sample = filtered[safeIndex];

  // Clear result when sample changes
  useEffect(() => {
    setResultDataUrl(null);
    setCropRect(null);
  }, [sample]);

  const toggleTransform = useCallback((name: TransformName) => {
    setEnabled((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
    setResultDataUrl(null);
    setCropRect(null);
  }, []);

  const applyTransform = useCallback(async () => {
    if (enabled.length === 0 || loading) return;

    // Build the transforms list for the Python backend
    const transforms: { name: string; params: Record<string, number> }[] = [];

    for (const name of enabled) {
      if (name === "RandomResizedCrop") {
        transforms.push({
          name: "RandomResizedCrop",
          params: { size: outputSize, scale_min: scaleMin, scale_max: scaleMax },
        });
      } else if (name === "ColorJitter") {
        transforms.push({
          name: "ColorJitter",
          params: { brightness: cjBrightness, contrast: cjContrast, saturation: cjSaturation, hue: cjHue },
        });
      } else if (name === "Grayscale") {
        transforms.push({
          name: "Grayscale",
          params: { num_output_channels: gsChannels },
        });
      } else if (name === "Solarize") {
        transforms.push({
          name: "Solarize",
          params: { threshold: solarizeThreshold },
        });
      } else if (name === "HorizontalFlip") {
        transforms.push({
          name: "HorizontalFlip",
          params: {},
        });
      }
    }

    setLoading(true);

    try {
      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: sample.image, transforms }),
      });

      const data = await res.json();

      if (data.error) {
        console.error("Transform error:", data.error);
        return;
      }

      setResultDataUrl(`data:image/png;base64,${data.image}`);
      setCropRect(data.crop_rect ?? null);
    } catch (err) {
      console.error("Transform request failed:", err);
    } finally {
      setLoading(false);
    }
  }, [enabled, loading, sample.image, outputSize, scaleMin, scaleMax, cjBrightness, cjContrast, cjSaturation, cjHue, gsChannels]);

  return (
    <div className="not-prose my-8 rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* ── Row 1: dataset controls ── */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          Class
          <select
            value={filterClass}
            onChange={(e) => {
              setFilterClass(e.target.value);
              setSelectedIndex(0);
            }}
            className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by class"
          >
            <option value="all">All classes</option>
            {classes.map((c, i) => (
              <option key={c} value={c}>
                {i} &mdash; {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          Sample
          <input
            type="number"
            min={1}
            max={filtered.length}
            value={safeIndex + 1}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 1 && v <= filtered.length) setSelectedIndex(v - 1);
            }}
            className="w-16 rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Select sample number"
          />
          <span className="text-muted-foreground text-sm">/ {filtered.length}</span>
        </label>

        <button
          onClick={() => setSelectedIndex(Math.floor(Math.random() * filtered.length))}
          className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent/10 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Pick random sample"
        >
          Random
        </button>
      </div>

      {/* ── Row 2: label info ── */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl font-bold text-foreground">
          {sample.className}
        </span>
        <span className="rounded-full bg-accent/15 px-3 py-0.5 text-sm font-semibold text-accent tabular-nums">
          label {sample.label}
        </span>
        <span className="text-sm text-muted-foreground">
          Dataset index: {sample.index} &middot; 32&times;32 RGB
        </span>
      </div>

      {/* ── Row 3: images ── */}
      <div className="flex flex-wrap items-start gap-6 mb-6">
        <div className="relative rounded-lg border border-border bg-muted p-2 flex-shrink-0">
          <img
            src={`data:image/png;base64,${sample.image}`}
            alt={`CIFAR-10 sample: ${sample.className}`}
            width={128}
            height={128}
            className="block"
            style={{ imageRendering: "pixelated" }}
          />
          {cropRect && (
            <div
              className="absolute border-2 border-accent rounded-sm pointer-events-none"
              style={{
                left: `${8 + cropRect.x * 4}px`,
                top: `${8 + cropRect.y * 4}px`,
                width: `${cropRect.w * 4}px`,
                height: `${cropRect.h * 4}px`,
              }}
            />
          )}
        </div>

        {enabled.length > 0 && (
          <div className="rounded-lg border border-border bg-muted p-2 flex items-center justify-center flex-shrink-0" style={{ minWidth: 128, minHeight: 128 }}>
            {loading ? (
              <span className="text-xs text-muted-foreground animate-pulse">Running torchvision...</span>
            ) : resultDataUrl ? (
              <img
                src={resultDataUrl}
                alt={`Transformed: ${sample.className}`}
                width={128}
                height={128}
                className="block"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <span className="text-xs text-muted-foreground">Click Apply</span>
            )}
          </div>
        )}
      </div>

      {/* ── Transforms ── */}
      <div className="border-t border-border pt-5 space-y-4">
        {/* Dropdown to toggle transforms */}
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          Transform
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) toggleTransform(e.target.value as TransformName);
              e.target.value = "";
            }}
            className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Toggle transform"
          >
            <option value="" disabled>Select...</option>
            {ALL_TRANSFORMS.map((name) => (
              <option key={name} value={name}>
                {enabled.includes(name) ? `\u2713  ${name}` : `\u2003  ${name}`}
              </option>
            ))}
          </select>
        </label>

        {/* ── Enabled transform code blocks (in selection order) ── */}
        {enabled.map((name, i) => (
          <div key={name}>
            {i > 0 && <hr className="border-border mb-4" />}

            {name === "RandomResizedCrop" && (
              <pre className="rounded-lg bg-muted px-5 py-4 text-sm font-mono text-foreground leading-relaxed overflow-x-auto">
                <span className="text-muted-foreground">transforms.</span>
                <span>RandomResizedCrop</span>
                <span className="text-muted-foreground">(</span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">size</span>
                <span className="text-muted-foreground">=</span>
                <input
                  type="number" min={1} max={128} value={outputSize}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 128) setOutputSize(v); }}
                  className="w-16 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Output size"
                />
                <span className="text-muted-foreground">,</span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">scale</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-muted-foreground">(</span>
                <input
                  type="number" min={0.01} max={1} step={0.01} value={scaleMin}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 0.01 && v <= 1) setScaleMin(v); }}
                  className="w-20 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Scale minimum"
                />
                <span className="text-muted-foreground">, </span>
                <input
                  type="number" min={0.01} max={1} step={0.01} value={scaleMax}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 0.01 && v <= 1) setScaleMax(v); }}
                  className="w-20 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Scale maximum"
                />
                <span className="text-muted-foreground">)</span>
                {"\n"}
                <span className="text-muted-foreground">)</span>
              </pre>
            )}

            {name === "ColorJitter" && (
              <pre className="rounded-lg bg-muted px-5 py-4 text-sm font-mono text-foreground leading-relaxed overflow-x-auto">
                <span className="text-muted-foreground">transforms.</span>
                <span>ColorJitter</span>
                <span className="text-muted-foreground">(</span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">brightness</span>
                <span className="text-muted-foreground">=</span>
                <input
                  type="number" min={0} max={2} step={0.1} value={cjBrightness}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 2) setCjBrightness(v); }}
                  className="w-16 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Brightness"
                />
                <span className="text-muted-foreground">,</span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">contrast</span>
                <span className="text-muted-foreground">=</span>
                <input
                  type="number" min={0} max={2} step={0.1} value={cjContrast}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 2) setCjContrast(v); }}
                  className="w-16 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Contrast"
                />
                <span className="text-muted-foreground">,</span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">saturation</span>
                <span className="text-muted-foreground">=</span>
                <input
                  type="number" min={0} max={2} step={0.1} value={cjSaturation}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 2) setCjSaturation(v); }}
                  className="w-16 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Saturation"
                />
                <span className="text-muted-foreground">,</span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">hue</span>
                <span className="text-muted-foreground">=</span>
                <input
                  type="number" min={0} max={0.5} step={0.05} value={cjHue}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 0.5) setCjHue(v); }}
                  className="w-16 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Hue"
                />
                {"\n"}
                <span className="text-muted-foreground">)</span>
              </pre>
            )}

            {name === "Grayscale" && (
              <pre className="rounded-lg bg-muted px-5 py-4 text-sm font-mono text-foreground leading-relaxed overflow-x-auto">
                <span className="text-muted-foreground">transforms.</span>
                <span>Grayscale</span>
                <span className="text-muted-foreground">(</span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">num_output_channels</span>
                <span className="text-muted-foreground">=</span>
                <select
                  value={gsChannels}
                  onChange={(e) => setGsChannels(Number(e.target.value) as 1 | 3)}
                  className="rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Number of output channels"
                >
                  <option value={1}>1</option>
                  <option value={3}>3</option>
                </select>
                {"\n"}
                <span className="text-muted-foreground">)</span>
              </pre>
            )}

            {name === "Solarize" && (
              <pre className="rounded-lg bg-muted px-5 py-4 text-sm font-mono text-foreground leading-relaxed overflow-x-auto">
                <span className="text-muted-foreground">transforms.functional.</span>
                <span>solarize</span>
                <span className="text-muted-foreground">(</span>
                <span className="text-muted-foreground">img, </span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">threshold</span>
                <span className="text-muted-foreground">=</span>
                <input
                  type="number" min={0} max={255} value={solarizeThreshold}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 255) setSolarizeThreshold(v); }}
                  className="w-16 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Solarize threshold"
                />
                {"\n"}
                <span className="text-muted-foreground">)</span>
              </pre>
            )}

            {name === "HorizontalFlip" && (
              <pre className="rounded-lg bg-muted px-5 py-4 text-sm font-mono text-foreground leading-relaxed overflow-x-auto">
                <span className="text-muted-foreground">transforms.functional.</span>
                <span>hflip</span>
                <span className="text-muted-foreground">(</span>
                <span className="text-muted-foreground">img</span>
                <span className="text-muted-foreground">)</span>
              </pre>
            )}
          </div>
        ))}

        {/* ── Apply / Reset buttons ── */}
        {enabled.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={applyTransform}
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Apply transforms"
            >
              {loading ? "Running..." : "Apply"}
            </button>
            <button
              onClick={() => { setEnabled([]); setResultDataUrl(null); setCropRect(null); }}
              className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/10 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Reset transforms"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* ── Floating chatbot ── */}
      <TransformChatBot />
    </div>
  );
}
