"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import cifar from "../data/cifar10-samples.json";

interface Sample {
  index: number;
  label: number;
  className: string;
  image: string;
}

const samples = cifar.samples as Sample[];
const classes = cifar.classes as string[];

type TransformName = "RandomResizedCrop" | "ColorJitter";
const ALL_TRANSFORMS: TransformName[] = ["RandomResizedCrop", "ColorJitter"];

/* ── RandomResizedCrop (mirrors PyTorch logic) ─────────────────────── */

function randomResizedCrop(
  sourceCanvas: HTMLCanvasElement,
  outputSize: number,
  scaleMin: number,
  scaleMax: number,
  ratioMin: number,
  ratioMax: number,
): { canvas: HTMLCanvasElement; cropRect: { x: number; y: number; w: number; h: number } } {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const area = w * h;

  for (let attempt = 0; attempt < 10; attempt++) {
    const targetArea = area * (scaleMin + Math.random() * (scaleMax - scaleMin));
    const logRatioMin = Math.log(ratioMin);
    const logRatioMax = Math.log(ratioMax);
    const aspectRatio = Math.exp(logRatioMin + Math.random() * (logRatioMax - logRatioMin));

    const cropW = Math.round(Math.sqrt(targetArea * aspectRatio));
    const cropH = Math.round(Math.sqrt(targetArea / aspectRatio));

    if (cropW <= w && cropH <= h) {
      const x = Math.floor(Math.random() * (w - cropW + 1));
      const y = Math.floor(Math.random() * (h - cropH + 1));

      const out = document.createElement("canvas");
      out.width = outputSize;
      out.height = outputSize;
      const ctx = out.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sourceCanvas, x, y, cropW, cropH, 0, 0, outputSize, outputSize);
      return { canvas: out, cropRect: { x, y, w: cropW, h: cropH } };
    }
  }

  // Fallback: centre crop
  const inRatio = w / h;
  let cropW: number, cropH: number;
  if (inRatio < ratioMin) {
    cropW = w;
    cropH = Math.round(w / ratioMin);
  } else if (inRatio > ratioMax) {
    cropH = h;
    cropW = Math.round(h * ratioMax);
  } else {
    cropW = w;
    cropH = h;
  }
  const x = Math.floor((w - cropW) / 2);
  const y = Math.floor((h - cropH) / 2);

  const out = document.createElement("canvas");
  out.width = outputSize;
  out.height = outputSize;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, x, y, cropW, cropH, 0, 0, outputSize, outputSize);
  return { canvas: out, cropRect: { x, y, w: cropW, h: cropH } };
}

/* ── ColorJitter (mirrors PyTorch logic) ──────────────────────────── */

function colorJitter(
  sourceCanvas: HTMLCanvasElement,
  brightness: number,
  contrast: number,
  saturation: number,
  hue: number,
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;

  // PyTorch samples uniformly from [max(0,1-v), 1+v] for brightness/contrast/saturation
  const bFactor = 1 - brightness + Math.random() * 2 * brightness;
  const cFactor = 1 - contrast + Math.random() * 2 * contrast;
  const sFactor = 1 - saturation + Math.random() * 2 * saturation;
  // Hue: uniform in [-hue, hue], applied as rotation in degrees (*360)
  const hShift = (-hue + Math.random() * 2 * hue) * 360;

  // Read pixels
  const srcCtx = sourceCanvas.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, w, h);
  const outData = ctx.createImageData(w, h);
  const src = srcData.data;
  const dst = outData.data;

  for (let i = 0; i < src.length; i += 4) {
    let r = src[i] / 255;
    let g = src[i + 1] / 255;
    let b = src[i + 2] / 255;

    // Brightness
    r *= bFactor; g *= bFactor; b *= bFactor;

    // Contrast (around mean gray)
    r = cFactor * (r - 0.5) + 0.5;
    g = cFactor * (g - 0.5) + 0.5;
    b = cFactor * (b - 0.5) + 0.5;

    // Saturation (desaturate toward luminance)
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = sFactor * (r - lum) + lum;
    g = sFactor * (g - lum) + lum;
    b = sFactor * (b - lum) + lum;

    // Hue rotation via HSL
    const [hh, ss, ll] = rgbToHsl(r, g, b);
    const [nr, ng, nb] = hslToRgb(((hh + hShift / 360) % 1 + 1) % 1, ss, ll);
    r = nr; g = ng; b = nb;

    dst[i] = Math.round(Math.min(1, Math.max(0, r)) * 255);
    dst[i + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
    dst[i + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
    dst[i + 3] = src[i + 3];
  }

  ctx.putImageData(outData, 0, 0);
  return out;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

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
  const [cjProb, setCjProb] = useState(0.8);

  // Transform result
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Load source image into hidden canvas
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      sourceCanvasRef.current = c;
      setResultDataUrl(null);
      setCropRect(null);
    };
    img.src = `data:image/png;base64,${sample.image}`;
  }, [sample]);

  const toggleTransform = useCallback((name: TransformName) => {
    setEnabled((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
    setResultDataUrl(null);
    setCropRect(null);
  }, []);

  const applyTransform = useCallback(() => {
    if (!sourceCanvasRef.current || enabled.length === 0) return;

    let current = sourceCanvasRef.current;
    let rect: { x: number; y: number; w: number; h: number } | null = null;

    // Apply transforms in selection order
    for (const name of enabled) {

      if (name === "RandomResizedCrop") {
        const result = randomResizedCrop(current, outputSize, scaleMin, scaleMax, 0.75, 1.33);
        current = result.canvas;
        rect = result.cropRect;
      } else if (name === "ColorJitter") {
        if (Math.random() <= cjProb) {
          current = colorJitter(current, cjBrightness, cjContrast, cjSaturation, cjHue);
        }
      }
    }

    setResultDataUrl(current.toDataURL());
    setCropRect(rect);
  }, [enabled, outputSize, scaleMin, scaleMax, cjBrightness, cjContrast, cjSaturation, cjHue, cjProb]);

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
            {resultDataUrl ? (
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
                <span className="text-muted-foreground">,</span>
                {"\n"}
                <span>{"    "}</span>
                <span className="text-accent">prob</span>
                <span className="text-muted-foreground">=</span>
                <input
                  type="number" min={0} max={1} step={0.1} value={cjProb}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 1) setCjProb(v); }}
                  className="w-16 rounded border border-border bg-card px-2 py-0.5 text-center text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Probability"
                />
                {"\n"}
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
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Apply transforms"
            >
              Apply
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
    </div>
  );
}
