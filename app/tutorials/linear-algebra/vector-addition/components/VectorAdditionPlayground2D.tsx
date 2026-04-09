"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * 2D vector addition playground.
 *
 * - Drag the tip of vector **a** (indigo) or **b** (rose).
 * - The sum **a + b** (emerald) updates live.
 * - The parallelogram of `a, b, a+b` is drawn translucently to make the
 *   "tip-to-tail" addition visible.
 *
 * Pure SVG + pointer events. No D3 — for two vectors and a grid, raw SVG is
 * crisper, smaller, and easier to reason about than dragging in D3.
 */

const VIEW = 480;
const PADDING = 24;
const RANGE = 5; // world units shown on each axis (-RANGE..RANGE)
const SCALE = (VIEW - PADDING * 2) / (RANGE * 2);
const ORIGIN = VIEW / 2;

type Pt = { x: number; y: number };

function worldToSvg(p: Pt): Pt {
  return { x: ORIGIN + p.x * SCALE, y: ORIGIN - p.y * SCALE };
}
function svgToWorld(p: Pt): Pt {
  return { x: (p.x - ORIGIN) / SCALE, y: (ORIGIN - p.y) / SCALE };
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function VectorAdditionPlayground2D() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const arrowAId = useId();
  const arrowBId = useId();
  const arrowSumId = useId();

  const [a, setA] = useState<Pt>({ x: 3, y: 1 });
  const [b, setB] = useState<Pt>({ x: 1, y: 2.5 });
  const [snap, setSnap] = useState(false);
  const [dragging, setDragging] = useState<"a" | "b" | null>(null);

  const sum = useMemo<Pt>(() => ({ x: a.x + b.x, y: a.y + b.y }), [a, b]);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || !dragging) return;
      const rect = svg.getBoundingClientRect();
      // Map screen pixels → SVG viewBox coordinates
      const sx = ((clientX - rect.left) / rect.width) * VIEW;
      const sy = ((clientY - rect.top) / rect.height) * VIEW;
      let world = svgToWorld({ x: sx, y: sy });
      if (snap) {
        world = { x: Math.round(world.x), y: Math.round(world.y) };
      } else {
        world = { x: round1(world.x), y: round1(world.y) };
      }
      world.x = clamp(world.x, -RANGE, RANGE);
      world.y = clamp(world.y, -RANGE, RANGE);
      if (dragging === "a") setA(world);
      else setB(world);
    },
    [dragging, snap],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updateFromPointer(e.clientX, e.clientY);
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateFromPointer]);

  const aS = worldToSvg(a);
  const bS = worldToSvg(b);
  const sumS = worldToSvg(sum);
  const originS = worldToSvg({ x: 0, y: 0 });
  // Parallelogram: 0 → a → a+b → b → 0
  const parallelogram = [
    originS,
    aS,
    sumS,
    bS,
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  return (
    <div className="not-prose my-8 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
        <div className="flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="aspect-square w-full touch-none select-none"
            role="img"
            aria-label="Interactive 2D vector addition diagram"
          >
            <defs>
              <ArrowMarker id={arrowAId} color="var(--color-vec-a)" />
              <ArrowMarker id={arrowBId} color="var(--color-vec-b)" />
              <ArrowMarker id={arrowSumId} color="var(--color-vec-sum)" />
              <pattern
                id="grid-minor"
                width={SCALE}
                height={SCALE}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.5}
                  className="text-foreground/10"
                />
              </pattern>
            </defs>

            {/* Background grid */}
            <rect width={VIEW} height={VIEW} fill="url(#grid-minor)" />

            {/* Axes */}
            <line
              x1={PADDING}
              y1={ORIGIN}
              x2={VIEW - PADDING}
              y2={ORIGIN}
              stroke="currentColor"
              strokeWidth={1}
              className="text-foreground/40"
            />
            <line
              x1={ORIGIN}
              y1={PADDING}
              x2={ORIGIN}
              y2={VIEW - PADDING}
              stroke="currentColor"
              strokeWidth={1}
              className="text-foreground/40"
            />

            {/* Parallelogram */}
            <polygon
              points={parallelogram}
              fill="var(--color-vec-sum)"
              fillOpacity={0.07}
              stroke="var(--color-vec-sum)"
              strokeOpacity={0.25}
              strokeDasharray="3 3"
            />

            {/* Tip-to-tail ghost vectors (b shifted to a, a shifted to b) */}
            <line
              x1={aS.x}
              y1={aS.y}
              x2={sumS.x}
              y2={sumS.y}
              stroke="var(--color-vec-b)"
              strokeOpacity={0.35}
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            <line
              x1={bS.x}
              y1={bS.y}
              x2={sumS.x}
              y2={sumS.y}
              stroke="var(--color-vec-a)"
              strokeOpacity={0.35}
              strokeWidth={2}
              strokeDasharray="4 4"
            />

            {/* Sum vector */}
            <line
              x1={originS.x}
              y1={originS.y}
              x2={sumS.x}
              y2={sumS.y}
              stroke="var(--color-vec-sum)"
              strokeWidth={3}
              markerEnd={`url(#${arrowSumId})`}
            />

            {/* Vector a */}
            <line
              x1={originS.x}
              y1={originS.y}
              x2={aS.x}
              y2={aS.y}
              stroke="var(--color-vec-a)"
              strokeWidth={3}
              markerEnd={`url(#${arrowAId})`}
            />
            {/* Vector b */}
            <line
              x1={originS.x}
              y1={originS.y}
              x2={bS.x}
              y2={bS.y}
              stroke="var(--color-vec-b)"
              strokeWidth={3}
              markerEnd={`url(#${arrowBId})`}
            />

            {/* Drag handles */}
            <DragHandle
              cx={aS.x}
              cy={aS.y}
              color="var(--color-vec-a)"
              label="a"
              active={dragging === "a"}
              onPointerDown={(e) => {
                (e.target as SVGElement).setPointerCapture?.(e.pointerId);
                setDragging("a");
              }}
            />
            <DragHandle
              cx={bS.x}
              cy={bS.y}
              color="var(--color-vec-b)"
              label="b"
              active={dragging === "b"}
              onPointerDown={(e) => {
                (e.target as SVGElement).setPointerCapture?.(e.pointerId);
                setDragging("b");
              }}
            />

            {/* Sum tip badge */}
            <g transform={`translate(${sumS.x}, ${sumS.y})`}>
              <circle
                r={5}
                fill="var(--color-vec-sum)"
                stroke="var(--background)"
                strokeWidth={2}
              />
            </g>
          </svg>
        </div>

        <aside className="flex w-full flex-col gap-4 md:w-56">
          <Readout label="a" color="var(--color-vec-a)" v={a} />
          <Readout label="b" color="var(--color-vec-b)" v={b} />
          <Readout label="a + b" color="var(--color-vec-sum)" v={sum} highlight />
          <label className="mt-2 flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
              className="h-4 w-4 accent-vec-a"
            />
            Snap to integer grid
          </label>
          <p className="text-xs leading-relaxed text-foreground/50">
            Drag the colored circles at the tip of each vector.
          </p>
        </aside>
      </div>
    </div>
  );
}

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={8}
      refY={5}
      markerWidth={7}
      markerHeight={7}
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
}

function DragHandle({
  cx,
  cy,
  color,
  label,
  active,
  onPointerDown,
}: {
  cx: number;
  cy: number;
  color: string;
  label: string;
  active: boolean;
  onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => void;
}) {
  return (
    <g style={{ cursor: active ? "grabbing" : "grab" }}>
      <circle
        cx={cx}
        cy={cy}
        r={active ? 13 : 11}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={1}
      />
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        stroke="var(--background)"
        strokeWidth={2}
        onPointerDown={onPointerDown}
      />
      <text
        x={cx + 12}
        y={cy - 10}
        fontSize={13}
        fontWeight={600}
        fill={color}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

function Readout({
  label,
  color,
  v,
  highlight,
}: {
  label: string;
  color: string;
  v: Pt;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight ? "border-border bg-muted/40" : "border-border/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {label}
        </span>
        <span className="font-mono text-xs text-foreground/60">
          ({v.x.toFixed(1)}, {v.y.toFixed(1)})
        </span>
      </div>
    </div>
  );
}
