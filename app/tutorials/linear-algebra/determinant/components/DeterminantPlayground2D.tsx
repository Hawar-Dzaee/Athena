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

const COL1_COLOR = "var(--color-vec-a)";
const COL2_COLOR = "var(--color-vec-b)";

export function DeterminantPlayground2D() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const arrowCol1Id = useId();
  const arrowCol2Id = useId();

  const [col1, setCol1] = useState<Pt>({ x: 3, y: 1 });
  const [col2, setCol2] = useState<Pt>({ x: 1, y: 2 });
  const [snap, setSnap] = useState(false);
  const [dragging, setDragging] = useState<"col1" | "col2" | null>(null);
  const [showUnit, setShowUnit] = useState(false);

  const det = useMemo(() => col1.x * col2.y - col1.y * col2.x, [col1, col2]);

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
      if (dragging === "col1") setCol1(world);
      else setCol2(world);
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

  const o = worldToSvg({ x: 0, y: 0 });
  const c1 = worldToSvg(col1);
  const c2 = worldToSvg(col2);
  const tip = worldToSvg({ x: col1.x + col2.x, y: col1.y + col2.y });

  const parallelogram = [o, c1, tip, c2].map((p) => `${p.x},${p.y}`).join(" ");

  const unitSquare = [
    worldToSvg({ x: 0, y: 0 }),
    worldToSvg({ x: 1, y: 0 }),
    worldToSvg({ x: 1, y: 1 }),
    worldToSvg({ x: 0, y: 1 }),
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  const detSign = det > 0.001 ? "positive" : det < -0.001 ? "negative" : "zero";
  const fillColor =
    detSign === "positive"
      ? "var(--color-vec-sum)"
      : detSign === "negative"
        ? "oklch(0.65 0.2 30)"
        : "var(--color-muted-foreground)";

  return (
    <div className="not-prose my-8 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
        <div className="flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="aspect-square w-full touch-none select-none"
            role="img"
            aria-label="Interactive 2×2 determinant diagram — drag column vectors to change the parallelogram"
          >
            <defs>
              <ArrowMarker id={arrowCol1Id} color={COL1_COLOR} />
              <ArrowMarker id={arrowCol2Id} color={COL2_COLOR} />
              <pattern
                id="det-grid"
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

            <rect width={VIEW} height={VIEW} fill="url(#det-grid)" />

            {/* Axes */}
            <line
              x1={PADDING}
              y1={ORIGIN}
              x2={VIEW - PADDING}
              y2={ORIGIN}
              stroke="currentColor"
              strokeWidth={1}
              className="text-foreground/60"
            />
            <line
              x1={ORIGIN}
              y1={PADDING}
              x2={ORIGIN}
              y2={VIEW - PADDING}
              stroke="currentColor"
              strokeWidth={1}
              className="text-foreground/60"
            />

            {/* Unit square (toggle) */}
            {showUnit && (
              <polygon
                points={unitSquare}
                fill="var(--color-foreground)"
                fillOpacity={0.06}
                stroke="var(--color-foreground)"
                strokeOpacity={0.3}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            )}

            {/* Parallelogram */}
            <polygon
              points={parallelogram}
              fill={fillColor}
              fillOpacity={0.12}
              stroke={fillColor}
              strokeOpacity={0.4}
              strokeWidth={1.5}
              strokeDasharray={detSign === "zero" ? "4 4" : "none"}
            />

            {/* Ghost edges to complete parallelogram */}
            <line
              x1={c1.x}
              y1={c1.y}
              x2={tip.x}
              y2={tip.y}
              stroke={COL2_COLOR}
              strokeOpacity={0.3}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <line
              x1={c2.x}
              y1={c2.y}
              x2={tip.x}
              y2={tip.y}
              stroke={COL1_COLOR}
              strokeOpacity={0.3}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />

            {/* Column vectors */}
            <line
              x1={o.x}
              y1={o.y}
              x2={c1.x}
              y2={c1.y}
              stroke={COL1_COLOR}
              strokeWidth={3}
              markerEnd={`url(#${arrowCol1Id})`}
            />
            <line
              x1={o.x}
              y1={o.y}
              x2={c2.x}
              y2={c2.y}
              stroke={COL2_COLOR}
              strokeWidth={3}
              markerEnd={`url(#${arrowCol2Id})`}
            />

            {/* Drag handles */}
            <DragHandle
              cx={c1.x}
              cy={c1.y}
              color={COL1_COLOR}
              label="col₁"
              active={dragging === "col1"}
              onPointerDown={(e) => {
                (e.target as SVGElement).setPointerCapture?.(e.pointerId);
                setDragging("col1");
              }}
            />
            <DragHandle
              cx={c2.x}
              cy={c2.y}
              color={COL2_COLOR}
              label="col₂"
              active={dragging === "col2"}
              onPointerDown={(e) => {
                (e.target as SVGElement).setPointerCapture?.(e.pointerId);
                setDragging("col2");
              }}
            />

            {/* Orientation arc */}
            {detSign !== "zero" && <OrientationArc col1={col1} col2={col2} det={det} />}
          </svg>
        </div>

        <aside className="flex w-full flex-col gap-3 md:w-64">
          <MatrixDisplay col1={col1} col2={col2} />

          <div
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: fillColor }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: fillColor }}>
                det(A)
              </span>
              <span className="font-mono text-lg font-bold" style={{ color: fillColor }}>
                {det >= 0 ? " " : ""}
                {det.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {detSign === "positive" && "Positive — orientation preserved"}
              {detSign === "negative" && "Negative — orientation reversed"}
              {detSign === "zero" && "Zero — columns are parallel (singular)"}
            </p>
          </div>

          <FormulaBreakdown col1={col1} col2={col2} det={det} />

          <div className="mt-1 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
                className="h-4 w-4 accent-vec-a"
              />
              Snap to grid
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={showUnit}
                onChange={(e) => setShowUnit(e.target.checked)}
                className="h-4 w-4 accent-vec-a"
              />
              Show unit square
            </label>
          </div>

          <p className="mt-auto text-xs leading-relaxed text-foreground/50">
            Drag the circles to move each column vector. The shaded parallelogram is the
            image of the unit square under the matrix — its signed area is the determinant.
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
        fontSize={12}
        fontWeight={600}
        fill={color}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

function MatrixDisplay({ col1, col2 }: { col1: Pt; col2: Pt }) {
  return (
    <div className="rounded-lg border border-border/50 px-3 py-2">
      <div className="mb-1 text-xs font-medium text-muted-foreground">Matrix A</div>
      <div className="flex items-center gap-1 font-mono text-sm">
        <span className="text-foreground/40 text-lg leading-none">⎡</span>
        <div className="flex flex-col items-end">
          <span style={{ color: COL1_COLOR }}>{col1.x.toFixed(1)}</span>
          <span style={{ color: COL1_COLOR }}>{col1.y.toFixed(1)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span style={{ color: COL2_COLOR }}>{col2.x.toFixed(1)}</span>
          <span style={{ color: COL2_COLOR }}>{col2.y.toFixed(1)}</span>
        </div>
        <span className="text-foreground/40 text-lg leading-none">⎤</span>
      </div>
    </div>
  );
}

function FormulaBreakdown({ col1, col2, det }: { col1: Pt; col2: Pt; det: number }) {
  const ad = col1.x * col2.y;
  const bc = col1.y * col2.x;
  return (
    <div className="rounded-lg border border-border/50 px-3 py-2">
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        ad − bc
      </div>
      <div className="font-mono text-xs leading-relaxed text-foreground/80">
        <span>({col1.x.toFixed(1)})(</span>
        <span>{col2.y.toFixed(1)})</span>
        <span> − </span>
        <span>({col1.y.toFixed(1)})(</span>
        <span>{col2.x.toFixed(1)})</span>
        <br />
        <span>= {ad.toFixed(2)} − {bc.toFixed(2)}</span>
        <br />
        <span className="font-semibold">= {det.toFixed(2)}</span>
      </div>
    </div>
  );
}

function OrientationArc({ col1, col2, det }: { col1: Pt; col2: Pt; det: number }) {
  const angle1 = Math.atan2(col1.y, col1.x);
  const angle2 = Math.atan2(col2.y, col2.x);

  const r = 28;
  const o = worldToSvg({ x: 0, y: 0 });

  const startAngle = det > 0 ? angle1 : angle2;
  const endAngle = det > 0 ? angle2 : angle1;

  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  if (sweep > Math.PI) {
    sweep = 2 * Math.PI - sweep;
  }

  const x1 = o.x + r * Math.cos(-startAngle);
  const y1 = o.y + r * Math.sin(-startAngle);
  const x2 = o.x + r * Math.cos(-endAngle);
  const y2 = o.y + r * Math.sin(-endAngle);

  const largeArc = sweep > Math.PI ? 1 : 0;
  const sweepDir = det > 0 ? 1 : 0;

  const midAngle = startAngle + (det > 0 ? 1 : -1) * sweep / 2;
  const arrowX = o.x + (r + 10) * Math.cos(-midAngle);
  const arrowY = o.y + (r + 10) * Math.sin(-midAngle);

  const arcColor = det > 0 ? "var(--color-vec-sum)" : "oklch(0.65 0.2 30)";

  return (
    <g>
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweepDir} ${x2} ${y2}`}
        fill="none"
        stroke={arcColor}
        strokeWidth={1.5}
        strokeOpacity={0.5}
      />
      <text
        x={arrowX}
        y={arrowY}
        fontSize={11}
        fill={arcColor}
        fillOpacity={0.7}
        textAnchor="middle"
        dominantBaseline="central"
        pointerEvents="none"
      >
        {det > 0 ? "↺" : "↻"}
      </text>
    </g>
  );
}
