"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

const VIEW = 480;
const PADDING = 24;
const RANGE = 5;
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
function dot(a: Pt, b: Pt) {
  return a.x * b.x + a.y * b.y;
}
function len(v: Pt) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function ProjectionPlayground2D() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const arrowAId = useId();
  const arrowBId = useId();
  const arrowProjId = useId();
  const arrowResId = useId();

  const [a, setA] = useState<Pt>({ x: 3, y: 3 });
  const [b, setB] = useState<Pt>({ x: 4, y: 1 });
  const [snap, setSnap] = useState(false);
  const [dragging, setDragging] = useState<"a" | "b" | null>(null);

  const proj = useMemo<Pt>(() => {
    const bb = dot(b, b);
    if (bb < 1e-9) return { x: 0, y: 0 };
    const scalar = dot(a, b) / bb;
    return { x: scalar * b.x, y: scalar * b.y };
  }, [a, b]);

  const residual = useMemo<Pt>(
    () => ({ x: a.x - proj.x, y: a.y - proj.y }),
    [a, proj],
  );

  const scalar = useMemo(() => {
    const bb = dot(b, b);
    if (bb < 1e-9) return 0;
    return dot(a, b) / bb;
  }, [a, b]);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || !dragging) return;
      const rect = svg.getBoundingClientRect();
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

  const oS = worldToSvg({ x: 0, y: 0 });
  const aS = worldToSvg(a);
  const bS = worldToSvg(b);
  const projS = worldToSvg(proj);
  const bLen = len(b);

  const lineExtent = RANGE * 2;
  const bDir = bLen > 1e-9 ? { x: b.x / bLen, y: b.y / bLen } : { x: 1, y: 0 };
  const lineStartS = worldToSvg({ x: -bDir.x * lineExtent, y: -bDir.y * lineExtent });
  const lineEndS = worldToSvg({ x: bDir.x * lineExtent, y: bDir.y * lineExtent });

  const rightAngleSize = 10;
  const rightAnglePath = useMemo(() => {
    const projLen = len(proj);
    const resLen = len(residual);
    if (projLen < 0.3 || resLen < 0.3) return "";
    const px = proj.x / projLen;
    const py = proj.y / projLen;
    const rx = residual.x / resLen;
    const ry = residual.y / resLen;
    const s = rightAngleSize;
    const corner = projS;
    const p1 = { x: corner.x - px * s, y: corner.y + py * s };
    const p2 = {
      x: corner.x - px * s + rx * s,
      y: corner.y + py * s - ry * s,
    };
    const p3 = { x: corner.x + rx * s, y: corner.y - ry * s };
    return `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y}`;
  }, [proj, residual, projS]);

  return (
    <div className="not-prose my-8 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
        <div className="flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="aspect-square w-full touch-none select-none"
            role="img"
            aria-label="Interactive 2D vector projection diagram"
          >
            <defs>
              <ArrowMarker id={arrowAId} color="var(--color-vec-a)" />
              <ArrowMarker id={arrowBId} color="var(--color-vec-b)" />
              <ArrowMarker id={arrowProjId} color="var(--color-vec-sum)" />
              <ArrowMarker id={arrowResId} color="#f59e0b" />
              <pattern
                id="grid-proj"
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

            <rect width={VIEW} height={VIEW} fill="url(#grid-proj)" />

            {/* Axes */}
            <line
              x1={PADDING} y1={ORIGIN} x2={VIEW - PADDING} y2={ORIGIN}
              stroke="currentColor" strokeWidth={1} className="text-foreground/60"
            />
            <line
              x1={ORIGIN} y1={PADDING} x2={ORIGIN} y2={VIEW - PADDING}
              stroke="currentColor" strokeWidth={1} className="text-foreground/60"
            />

            {/* Extended line through b (the subspace) */}
            <line
              x1={lineStartS.x} y1={lineStartS.y}
              x2={lineEndS.x} y2={lineEndS.y}
              stroke="var(--color-vec-b)" strokeWidth={1} strokeOpacity={0.2}
            />

            {/* Dashed drop line from a to projection */}
            <line
              x1={aS.x} y1={aS.y}
              x2={projS.x} y2={projS.y}
              stroke="#f59e0b" strokeWidth={1.5}
              strokeDasharray="4 4" strokeOpacity={0.5}
            />

            {/* Right angle marker */}
            {rightAnglePath && (
              <path
                d={rightAnglePath}
                fill="none"
                stroke="var(--color-foreground)"
                strokeWidth={1}
                strokeOpacity={0.4}
              />
            )}

            {/* Projection vector (from origin to proj point) */}
            <line
              x1={oS.x} y1={oS.y}
              x2={projS.x} y2={projS.y}
              stroke="var(--color-vec-sum)" strokeWidth={3}
              markerEnd={`url(#${arrowProjId})`}
            />

            {/* Residual vector (from proj to a) */}
            <line
              x1={projS.x} y1={projS.y}
              x2={aS.x} y2={aS.y}
              stroke="#f59e0b" strokeWidth={2.5}
              markerEnd={`url(#${arrowResId})`}
            />

            {/* Vector a */}
            <line
              x1={oS.x} y1={oS.y}
              x2={aS.x} y2={aS.y}
              stroke="var(--color-vec-a)" strokeWidth={3}
              markerEnd={`url(#${arrowAId})`}
            />

            {/* Vector b */}
            <line
              x1={oS.x} y1={oS.y}
              x2={bS.x} y2={bS.y}
              stroke="var(--color-vec-b)" strokeWidth={3}
              markerEnd={`url(#${arrowBId})`}
            />

            {/* Drag handles */}
            <DragHandle
              cx={aS.x} cy={aS.y}
              color="var(--color-vec-a)" label="a"
              active={dragging === "a"}
              onPointerDown={(e) => {
                (e.target as SVGElement).setPointerCapture?.(e.pointerId);
                setDragging("a");
              }}
            />
            <DragHandle
              cx={bS.x} cy={bS.y}
              color="var(--color-vec-b)" label="b"
              active={dragging === "b"}
              onPointerDown={(e) => {
                (e.target as SVGElement).setPointerCapture?.(e.pointerId);
                setDragging("b");
              }}
            />

            {/* Projection tip */}
            <circle
              cx={projS.x} cy={projS.y} r={5}
              fill="var(--color-vec-sum)"
              stroke="var(--background)" strokeWidth={2}
            />
          </svg>
        </div>

        <aside className="flex w-full flex-col gap-4 md:w-56">
          <Readout label="a" color="var(--color-vec-a)" v={a} />
          <Readout label="b" color="var(--color-vec-b)" v={b} />
          <Readout label="proj" color="var(--color-vec-sum)" v={proj} highlight />
          <Readout label="residual" color="#f59e0b" v={residual} />
          <div className="rounded-lg border border-border/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/60">a · b</span>
              <span className="font-mono text-xs text-foreground/80">
                {dot(a, b).toFixed(2)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-foreground/60">scalar</span>
              <span className="font-mono text-xs text-foreground/80">
                {scalar.toFixed(3)}
              </span>
            </div>
          </div>
          <label className="mt-1 flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
              className="h-4 w-4 accent-vec-a"
            />
            Snap to grid
          </label>
          <p className="text-xs leading-relaxed text-foreground/50">
            Drag the tips of <strong>a</strong> and <strong>b</strong>. The
            emerald arrow is the projection of a onto b; amber is the
            residual. Notice the right angle.
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
      refX={8} refY={5}
      markerWidth={7} markerHeight={7}
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
}

function DragHandle({
  cx, cy, color, label, active, onPointerDown,
}: {
  cx: number; cy: number; color: string; label: string;
  active: boolean;
  onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => void;
}) {
  return (
    <g style={{ cursor: active ? "grabbing" : "grab" }}>
      <circle
        cx={cx} cy={cy} r={active ? 13 : 11}
        fill={color} fillOpacity={0.18}
        stroke={color} strokeWidth={1}
      />
      <circle
        cx={cx} cy={cy} r={6}
        fill={color} stroke="var(--background)" strokeWidth={2}
        onPointerDown={onPointerDown}
      />
      <text
        x={cx + 12} y={cy - 10}
        fontSize={13} fontWeight={600} fill={color}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

function Readout({
  label, color, v, highlight,
}: {
  label: string; color: string; v: Pt; highlight?: boolean;
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
