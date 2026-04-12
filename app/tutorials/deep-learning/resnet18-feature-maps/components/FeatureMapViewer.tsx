"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  generateAllLayers,
  generatePredictions,
  divergingColor,
  SAMPLE_IMAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  LAYERS,
  type LayerData,
} from "./feature-data";

// ─── Constants ─────────────────────────────────────────────────────

const THUMB_BASE = 110;
const THUMB_MIN = 70;
const MAP_GAP = 10;
const STAGE_GAP = 36;   // extra px between different stages
const INNER_GAP = 20;   // px between columns within same stage
const CONNECTOR_W = 24; // px width for connector SVGs

// ─── helpers ───────────────────────────────────────────────────────

function thumbSize(depth: number): number {
  return Math.round(THUMB_BASE - depth * (THUMB_BASE - THUMB_MIN));
}

/** Group consecutive layers by stage */
function stageGroups() {
  const groups: { stage: string; indices: number[] }[] = [];
  for (let i = 0; i < LAYERS.length; i++) {
    const last = groups[groups.length - 1];
    if (last && last.stage === LAYERS[i].stage) {
      last.indices.push(i);
    } else {
      groups.push({ stage: LAYERS[i].stage, indices: [i] });
    }
  }
  return groups;
}

// ─── FeatureMapThumb ───────────────────────────────────────────────

function FeatureMapThumb({
  data,
  displaySize,
  isInput,
  channelLabel,
}: {
  data: number[][];
  displaySize: number;
  isInput?: boolean;
  channelLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const h = data.length;
  const w = data[0]?.length ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || w === 0) return;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(w, h);

    let min = Infinity,
      max = -Infinity;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (data[y][x] < min) min = data[y][x];
        if (data[y][x] > max) max = data[y][x];
      }
    const range = max - min || 1;

    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = (data[y][x] - min) / range;
        const [r, g, b] = divergingColor(t);
        const idx = (y * w + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }

    ctx.putImageData(img, 0, 0);
  }, [data, w, h]);

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-5 text-right text-[8px] font-mono shrink-0 text-foreground/35">
        {channelLabel}
      </span>
      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        className="rounded-[3px] border border-border/50"
        style={{
          width: displaySize,
          height: displaySize,
          imageRendering: isInput ? "auto" : "pixelated",
        }}
        aria-label={`Feature map channel ${channelLabel}`}
      />
    </div>
  );
}

// ─── Connector SVG ─────────────────────────────────────────────────

function Connector({
  leftCount,
  rightCount,
  leftThumb,
  rightThumb,
  height,
}: {
  leftCount: number;
  rightCount: number;
  leftThumb: number;
  rightThumb: number;
  height: number;
}) {
  const leftStep = leftThumb + MAP_GAP;
  const rightStep = rightThumb + MAP_GAP;
  const topOffset = 0; // thumbnails start at top of this SVG

  const lines: { y1: number; y2: number }[] = [];
  for (let l = 0; l < leftCount; l++) {
    for (let r = 0; r < rightCount; r++) {
      lines.push({
        y1: topOffset + l * leftStep + leftThumb / 2,
        y2: topOffset + r * rightStep + rightThumb / 2,
      });
    }
  }

  return (
    <svg
      width={CONNECTOR_W}
      height={height}
      className="shrink-0"
      style={{ opacity: 0.10 }}
      aria-hidden
    >
      {lines.map((ln, i) => (
        <line
          key={i}
          x1={0} y1={ln.y1}
          x2={CONNECTOR_W} y2={ln.y2}
          stroke="currentColor"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  );
}

// ─── LayerColumn ────────────────────────────────────────────────────

function LayerColumn({
  layer,
  showStageLabel,
}: {
  layer: LayerData;
  showStageLabel: boolean;
}) {
  const color = STAGE_COLORS[layer.spec.stage];
  const size = thumbSize(layer.spec.depth);

  return (
    <div className="flex flex-col items-center shrink-0" style={{ gap: 2 }}>
      {/* stage label (only on first column of each stage) */}
      <div className="h-5 flex items-center">
        {showStageLabel && (
          <span
            className="text-[9px] font-bold tracking-widest uppercase"
            style={{ color, opacity: 0.7 }}
          >
            {STAGE_LABELS[layer.spec.stage]}
          </span>
        )}
      </div>

      {/* colored accent bar */}
      <div
        className="rounded-full"
        style={{
          width: size + 26, // label + thumb width
          height: 2,
          backgroundColor: color,
          opacity: 0.3,
        }}
      />

      {/* layer name + dims */}
      <div className="text-center pt-0.5">
        <div
          className="text-[10px] font-mono font-semibold leading-tight"
          style={{ color }}
        >
          {layer.spec.label}
        </div>
        <div className="text-[8px] font-mono text-foreground/35 leading-tight">
          {layer.spec.fullChannels} &times; {layer.spec.actualSpatial}
        </div>
      </div>

      {/* thumbnails */}
      <div
        className="flex flex-col items-center pt-1"
        style={{ gap: MAP_GAP }}
      >
        {layer.maps.map((map, i) => (
          <FeatureMapThumb
            key={i}
            data={map}
            displaySize={size}
            isInput={layer.spec.id === "input"}
            channelLabel={
              layer.spec.id === "input"
                ? ["R", "G", "B"][i]
                : String(layer.channelIndices[i])
            }
          />
        ))}
      </div>

      {/* "N of M" */}
      {layer.spec.displayChannels < layer.spec.fullChannels && (
        <div className="text-[8px] font-mono text-foreground/25 mt-0.5">
          {layer.spec.displayChannels} of {layer.spec.fullChannels}
        </div>
      )}
    </div>
  );
}

// ─── OutputColumn ───────────────────────────────────────────────────

function OutputColumn({
  predictions,
}: {
  predictions: { label: string; prob: number }[];
}) {
  const maxProb = predictions[0]?.prob ?? 1;

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: 130 }}>
      {/* align with stage label row */}
      <div className="h-5 flex items-center justify-center">
        <span className="text-[9px] font-bold tracking-widest uppercase text-indigo-400/70">
          Classifier
        </span>
      </div>
      <div className="h-[2px] rounded-full bg-indigo-400/30 mx-2" />

      <div className="text-center pt-1">
        <div className="text-[10px] font-mono font-semibold text-indigo-400 leading-tight">
          fc &rarr; softmax
        </div>
        <div className="text-[8px] font-mono text-foreground/35 leading-tight">
          1000 classes
        </div>
      </div>

      <div className="flex flex-col gap-[3px] pt-2.5">
        {predictions.slice(0, 10).map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="h-[12px] rounded-sm shrink-0"
              style={{
                width: Math.max(3, (p.prob / maxProb) * 70),
                backgroundColor: i === 0 ? "#6366f1" : "#6366f166",
              }}
            />
            <span className="text-[9px] font-mono text-foreground/55 truncate">
              {p.label}
            </span>
            <span className="text-[8px] font-mono text-foreground/25 ml-auto tabular-nums">
              {(p.prob * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Color legend ───────────────────────────────────────────────────

function ColorLegend() {
  const stops = 48;
  return (
    <div className="flex items-center gap-2 text-[9px] text-foreground/40 font-mono select-none">
      <span>&minus; low</span>
      <div
        className="flex h-[8px] rounded-sm overflow-hidden"
        style={{ width: 100 }}
      >
        {Array.from({ length: stops }, (_, i) => {
          const t = i / (stops - 1);
          const [r, g, b] = divergingColor(t);
          return (
            <div
              key={i}
              style={{ backgroundColor: `rgb(${r},${g},${b})`, flex: 1 }}
            />
          );
        })}
      </div>
      <span>high +</span>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export default function FeatureMapViewer() {
  const [imageIdx, setImageIdx] = useState(0);

  const layers = useMemo(() => generateAllLayers(imageIdx), [imageIdx]);
  const predictions = useMemo(
    () => generatePredictions(imageIdx),
    [imageIdx],
  );
  const groups = useMemo(stageGroups, []);

  // height for connector SVGs: tallest thumb column
  const thumbH =
    THUMB_BASE * 4 + MAP_GAP * 3 + 8; // 4 maps + gaps + padding

  return (
    <div
      className="my-8 -mx-40 rounded-xl border border-border bg-card/60 backdrop-blur"
      role="figure"
      aria-label="ResNet-18 feature map flow visualization"
    >
      {/* ── top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-foreground/50 font-medium">
            Input:
          </span>
          {SAMPLE_IMAGES.map((img, i) => (
            <button
              key={i}
              onClick={() => setImageIdx(i)}
              aria-pressed={i === imageIdx}
              className={`px-3 py-1 text-xs rounded-md border transition-all ${
                i === imageIdx
                  ? "border-accent bg-accent/10 text-accent font-semibold"
                  : "border-border text-foreground/40 hover:border-foreground/30 hover:text-foreground/60"
              }`}
            >
              {img.label}
            </button>
          ))}
        </div>
        <ColorLegend />
      </div>

      {/* ── scrollable visualization ── */}
      <div className="overflow-x-auto">
        <div className="flex items-start min-w-max px-5 py-4" style={{ gap: 0 }}>
          {groups.map((group, gi) => (
            <div key={group.stage} className="flex items-start" style={{ gap: 0 }}>
              {/* stage gap before this group (except the first) */}
              {gi > 0 && <div style={{ width: STAGE_GAP }} className="shrink-0" />}

              {/* columns within this stage */}
              {group.indices.map((layerIdx, ci) => {
                const layer = layers[layerIdx];
                const nextLayer = layerIdx < layers.length - 1 ? layers[layerIdx + 1] : null;
                const isLastInGroup = ci === group.indices.length - 1;
                const isLastLayer = layerIdx === layers.length - 1;

                return (
                  <div key={layer.spec.id} className="flex items-start" style={{ gap: 0 }}>
                    {/* inner gap (between columns in same stage, after first) */}
                    {ci > 0 && <div style={{ width: INNER_GAP }} className="shrink-0" />}

                    <LayerColumn
                      layer={layer}
                      showStageLabel={ci === 0}
                    />

                    {/* connector to next column */}
                    {!isLastLayer && nextLayer && (
                      <div style={{ paddingLeft: isLastInGroup ? 4 : 2, paddingRight: isLastInGroup ? 4 : 2 }}>
                        <div style={{ paddingTop: 56 }}>
                          <Connector
                            leftCount={layer.maps.length}
                            rightCount={nextLayer.maps.length}
                            leftThumb={thumbSize(layer.spec.depth)}
                            rightThumb={thumbSize(nextLayer.spec.depth)}
                            height={thumbH}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* connector + output column */}
          <div className="flex items-start" style={{ gap: 0 }}>
            <div style={{ width: STAGE_GAP }} className="shrink-0" />
            <div style={{ paddingTop: 56 }}>
              <svg
                width={CONNECTOR_W}
                height={thumbH}
                className="shrink-0"
                style={{ opacity: 0.10 }}
                aria-hidden
              >
                {layers[layers.length - 1].maps.map((_, i) => {
                  const s = thumbSize(1);
                  return (
                    <line
                      key={i}
                      x1={0}
                      y1={i * (s + MAP_GAP) + s / 2}
                      x2={CONNECTOR_W}
                      y2={thumbH / 2}
                      stroke="currentColor"
                      strokeWidth={0.6}
                    />
                  );
                })}
              </svg>
            </div>
            <OutputColumn predictions={predictions} />
          </div>
        </div>
      </div>

      {/* ── caption ── */}
      <div className="px-5 pb-4 text-[11px] text-foreground/35 leading-relaxed max-w-2xl">
        Showing a handful of representative channels per layer. In reality
        the channel count grows from 3&nbsp;(RGB) through
        64&nbsp;&rarr;&nbsp;128&nbsp;&rarr;&nbsp;256&nbsp;&rarr;&nbsp;512,
        while spatial resolution shrinks from 224&times;224 down to
        7&times;7. The increasingly &ldquo;blocky&rdquo; thumbnails reflect
        that shrinking resolution.
      </div>
    </div>
  );
}
