"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlowProvider,
  BaseEdge,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  RESNET18_SPEC,
  TOTAL_PARAMS,
  accentFor,
  formatParams,
  formatShape,
  type BasicBlockSpec,
  type DiagramNode,
  type Sublayer,
} from "./resnet18-spec";

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const NODE_W = 260;
const NODE_H = 82;
const Y_STEP = 112;
const COL_X = [40, 520] as const;

// Which column each node lives in and what row within that column.
// Two columns keep the whole diagram readable without forcing fitView to
// shrink nodes below legible size.
const LAYOUT: Record<string, { col: 0 | 1; row: number }> = {
  input:   { col: 0, row: 0 },
  stem:    { col: 0, row: 1 },
  "bb-1-0": { col: 0, row: 2 },
  "bb-1-1": { col: 0, row: 3 },
  "bb-2-0": { col: 0, row: 4 },
  "bb-2-1": { col: 0, row: 5 },
  "bb-3-0": { col: 1, row: 0 },
  "bb-3-1": { col: 1, row: 1 },
  "bb-4-0": { col: 1, row: 2 },
  "bb-4-1": { col: 1, row: 3 },
  avgpool: { col: 1, row: 4 },
  fc:      { col: 1, row: 5 },
  output:  { col: 1, row: 6 },
};

// ---------------------------------------------------------------------------
// Node data types
// ---------------------------------------------------------------------------

type DiagramNodeData = {
  spec: DiagramNode;
  accent: string;
  selected: boolean;
  // Which side the residual skip handles live on (if applicable).
  skipSide: "left" | "right";
};

type StageRFNode = Node<DiagramNodeData, "stage">;
type BasicBlockRFNode = Node<DiagramNodeData, "basicblock">;
type AnyRFNode = StageRFNode | BasicBlockRFNode;

// ---------------------------------------------------------------------------
// Custom node components
// ---------------------------------------------------------------------------

function NodeShell({
  spec,
  accent,
  selected,
}: {
  spec: DiagramNode;
  accent: string;
  selected: boolean;
}) {
  const subtitle = (() => {
    switch (spec.kind) {
      case "input":
        return `shape  ${formatShape(spec.outShape)}`;
      case "stem":
        return `→ ${formatShape(spec.outShape)}`;
      case "basicblock":
        return `→ ${formatShape(spec.outShape)}${spec.stride === 2 ? "  · stride 2" : ""}`;
      case "avgpool":
        return `→ ${formatShape(spec.outShape)}`;
      case "fc":
        return `${spec.inFeatures} → ${spec.outFeatures}`;
      case "output":
        return `${spec.logits} logits`;
    }
  })();

  return (
    <div
      className="relative flex h-full w-full flex-col justify-center overflow-hidden rounded-xl border-2 px-4 py-2.5 shadow-sm backdrop-blur-sm transition"
      style={{
        width: NODE_W,
        height: NODE_H,
        borderColor: selected ? accent : `${accent}66`,
        background: selected ? `${accent}22` : `${accent}11`,
        boxShadow: selected ? `0 0 0 4px ${accent}33` : undefined,
      }}
    >
      {/* Stage accent bar on the left edge */}
      <div
        className="absolute top-0 left-0 h-full w-1"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="flex items-baseline justify-between gap-2 pl-2">
        <span
          className="truncate text-[13px] font-semibold tracking-tight"
          style={{ color: accent }}
        >
          {spec.label}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-foreground/55">
          {spec.params ? formatParams(spec.params) : ""}
        </span>
      </div>
      <div className="pl-2 font-mono text-[11px] text-foreground/70">{subtitle}</div>
    </div>
  );
}

function StageNodeComp({ data }: NodeProps<StageRFNode>) {
  return (
    <>
      <Handle type="target" position={Position.Top} id="main-in" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="main-out" style={handleStyle} />
      {/* Column-transition handles (used only on bb-2-1 and bb-3-0 in practice,
          but harmless elsewhere). */}
      <Handle type="source" position={Position.Right} id="col-out" style={hiddenHandleStyle} />
      <Handle type="target" position={Position.Left} id="col-in" style={hiddenHandleStyle} />
      <NodeShell spec={data.spec} accent={data.accent} selected={data.selected} />
    </>
  );
}

function BasicBlockNodeComp({ data }: NodeProps<BasicBlockRFNode>) {
  const skipPosition = data.skipSide === "left" ? Position.Left : Position.Right;
  // Offset skip handles vertically so the curve spans the whole block height.
  const skipSrcStyle = {
    ...hiddenHandleStyle,
    top: 6,
    [data.skipSide]: -2,
  } as React.CSSProperties;
  const skipDstStyle = {
    ...hiddenHandleStyle,
    top: NODE_H - 6,
    [data.skipSide]: -2,
  } as React.CSSProperties;

  return (
    <>
      <Handle type="target" position={Position.Top} id="main-in" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="main-out" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="col-out" style={hiddenHandleStyle} />
      <Handle type="target" position={Position.Left} id="col-in" style={hiddenHandleStyle} />
      <Handle type="source" position={skipPosition} id="skip-src" style={skipSrcStyle} />
      <Handle type="target" position={skipPosition} id="skip-dst" style={skipDstStyle} />
      <NodeShell spec={data.spec} accent={data.accent} selected={data.selected} />
    </>
  );
}

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "var(--color-border)",
  border: "none",
};

const hiddenHandleStyle: React.CSSProperties = {
  width: 1,
  height: 1,
  background: "transparent",
  border: "none",
  opacity: 0,
};

const nodeTypes = {
  stage: StageNodeComp,
  basicblock: BasicBlockNodeComp,
};

// ---------------------------------------------------------------------------
// Custom residual edge — a right/left-arcing bezier that hugs the block it
// bypasses, making the skip connection visually distinct from the main flow.
// ---------------------------------------------------------------------------

type ResidualData = { accent: string; downsample: boolean };
type ResidualEdge = Edge<ResidualData, "residual">;

function ResidualEdgeComp({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps<ResidualEdge>) {
  const accent = data?.accent ?? "#94a3b8";
  const downsample = Boolean(data?.downsample);
  // Direction: positive offset arcs right, negative arcs left.
  const dir = sourceX >= targetX ? 1 : -1;
  const offset = 90 * dir;
  const path = `M ${sourceX},${sourceY} C ${sourceX + offset},${sourceY} ${targetX + offset},${targetY} ${targetX},${targetY}`;
  const midX = (sourceX + targetX) / 2 + offset * 0.9;
  const midY = (sourceY + targetY) / 2;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: accent,
          strokeWidth: 2,
          strokeDasharray: downsample ? undefined : "5 5",
          opacity: 0.85,
        }}
      />
      <text
        x={midX}
        y={midY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          fill: accent,
          pointerEvents: "none",
        }}
      >
        {downsample ? "1×1 proj" : "identity"}
      </text>
    </>
  );
}

const edgeTypes = {
  residual: ResidualEdgeComp,
};

// ---------------------------------------------------------------------------
// Build the React Flow graph from the spec
// ---------------------------------------------------------------------------

function buildGraph(selectedId: string | null): { nodes: AnyRFNode[]; edges: Edge[] } {
  const nodes: AnyRFNode[] = RESNET18_SPEC.map((spec) => {
    const layout = LAYOUT[spec.id];
    const x = COL_X[layout.col];
    const y = layout.row * Y_STEP;
    const skipSide: "left" | "right" = layout.col === 0 ? "left" : "right";
    const data: DiagramNodeData = {
      spec,
      accent: accentFor(spec),
      selected: selectedId === spec.id,
      skipSide,
    };
    return {
      id: spec.id,
      type: spec.kind === "basicblock" ? "basicblock" : "stage",
      position: { x, y },
      data,
      draggable: false,
      selectable: true,
    };
  });

  const edges: Edge[] = [];

  // Main forward flow between consecutive nodes.
  for (let i = 0; i < RESNET18_SPEC.length - 1; i++) {
    const a = RESNET18_SPEC[i];
    const b = RESNET18_SPEC[i + 1];
    const aLayout = LAYOUT[a.id];
    const bLayout = LAYOUT[b.id];
    const sameCol = aLayout.col === bLayout.col;
    edges.push({
      id: `flow-${a.id}-${b.id}`,
      source: a.id,
      target: b.id,
      sourceHandle: sameCol ? "main-out" : "col-out",
      targetHandle: sameCol ? "main-in" : "col-in",
      type: "smoothstep",
      style: { stroke: "var(--color-border)", strokeWidth: 2.5 },
    });
  }

  // Residual skip self-loops on every BasicBlock.
  for (const spec of RESNET18_SPEC) {
    if (spec.kind !== "basicblock") continue;
    const bb = spec as BasicBlockSpec;
    edges.push({
      id: `skip-${bb.id}`,
      source: bb.id,
      target: bb.id,
      sourceHandle: "skip-src",
      targetHandle: "skip-dst",
      type: "residual",
      data: { accent: accentFor(bb), downsample: bb.downsample },
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Info card — sits to the RIGHT of the diagram as a vertical panel. Always
// visible (empty-state when nothing is selected) so the layout doesn't jump
// as the user moves between blocks.
// ---------------------------------------------------------------------------

function kindLabel(spec: DiagramNode): string {
  switch (spec.kind) {
    case "input":       return "Input";
    case "stem":        return "Stem · conv1 + bn1 + relu + maxpool";
    case "basicblock":
      return `BasicBlock · layer${spec.stage}${spec.downsample ? " · with 1×1 downsample" : ""}`;
    case "avgpool":     return "Head · global average pool";
    case "fc":          return "Head · classifier";
    case "output":      return "Output";
  }
}

function LegendRow() {
  return (
    <div className="text-[11px] text-foreground/60">
      <div className="mb-1.5 font-semibold tracking-wide text-foreground/45 uppercase">
        Residual edges
      </div>
      <div className="flex items-center gap-2">
        <svg width="34" height="8" aria-hidden>
          <line
            x1="2"
            y1="4"
            x2="32"
            y2="4"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
        </svg>
        identity skip
      </div>
      <div className="mt-1 flex items-center gap-2">
        <svg width="34" height="8" aria-hidden>
          <line x1="2" y1="4" x2="32" y2="4" stroke="currentColor" strokeWidth="2" />
        </svg>
        1×1 projection (shape change)
      </div>
    </div>
  );
}

function InfoCard({
  spec,
  onClear,
}: {
  spec: DiagramNode | null;
  onClear: () => void;
}) {
  const accent = spec ? accentFor(spec) : "var(--color-border)";
  const sublayers: readonly Sublayer[] =
    spec && "sublayers" in spec ? spec.sublayers : [];

  return (
    <aside
      className="flex h-[620px] flex-col overflow-hidden rounded-xl border border-border/60 bg-background/60"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold tracking-wide text-foreground/45 uppercase">
              {spec ? kindLabel(spec) : "ResNet-18"}
            </div>
            <div className="mt-0.5 text-[15px] font-semibold text-foreground">
              {spec ? spec.label : "Click or hover a block"}
            </div>
          </div>
          {spec ? (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded-md px-2 py-0.5 text-[11px] text-foreground/50 transition hover:bg-muted hover:text-foreground"
              aria-label="Clear selection"
            >
              clear
            </button>
          ) : null}
        </div>

        {spec ? (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11.5px] text-foreground/80">
            {"inShape" in spec && spec.inShape ? (
              <>
                <dt className="text-foreground/50">in</dt>
                <dd>{formatShape(spec.inShape)}</dd>
              </>
            ) : null}
            {"outShape" in spec && spec.outShape ? (
              <>
                <dt className="text-foreground/50">out</dt>
                <dd>{formatShape(spec.outShape)}</dd>
              </>
            ) : null}
            {spec.kind === "fc" ? (
              <>
                <dt className="text-foreground/50">out</dt>
                <dd>{spec.outFeatures}</dd>
              </>
            ) : null}
            {spec.kind === "output" ? (
              <>
                <dt className="text-foreground/50">out</dt>
                <dd>{spec.logits} logits</dd>
              </>
            ) : null}
            {spec.params > 0 ? (
              <>
                <dt className="text-foreground/50">params</dt>
                <dd>
                  {spec.params.toLocaleString()}{" "}
                  <span className="text-foreground/40">
                    ({formatParams(spec.params)})
                  </span>
                </dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-[11.5px] leading-relaxed text-foreground/60">
            Every node maps to an actual{" "}
            <code className="font-mono">nn.Module</code> from{" "}
            <code className="font-mono">torchvision.models.resnet18()</code>.
          </p>
        )}
      </div>

      {/* Body — sublayers, scrollable if long */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {sublayers.length > 0 ? (
          <>
            <div className="text-[10px] font-semibold tracking-wide text-foreground/45 uppercase">
              PyTorch modules
            </div>
            <ul className="mt-2 space-y-1.5">
              {sublayers.map((sl) => (
                <li key={sl.name} className="font-mono text-[11.5px] leading-relaxed">
                  <div className="break-all text-foreground/85">{sl.py}</div>
                  {sl.note ? (
                    <div className="mt-0.5 text-[10.5px] text-foreground/50 italic">
                      {sl.note}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : spec ? (
          <div className="text-[12px] text-foreground/55">No learnable submodules.</div>
        ) : null}
      </div>

      {/* Footer — legend */}
      <div className="shrink-0 border-t border-border/50 bg-muted/20 px-4 py-3">
        <LegendRow />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

interface FlowCanvasProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onHoverChange: (id: string | null) => void;
}

function FlowCanvas({ selectedId, onSelect, onHoverChange }: FlowCanvasProps) {
  const { nodes, edges } = useMemo(() => buildGraph(selectedId), [selectedId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelect(node.id);
    },
    [onSelect],
  );

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onHoverChange(node.id);
    },
    [onHoverChange],
  );

  const onNodeMouseLeave = useCallback(() => {
    onHoverChange(null);
  }, [onHoverChange]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.3}
      maxZoom={1.8}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      onPaneClick={() => onSelect(null)}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="var(--color-border)"
      />
      <Controls
        position="bottom-left"
        showInteractive={false}
        style={{
          background: "var(--color-background)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
        }}
      />
      <Panel position="top-left">
        <div className="pointer-events-none rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur">
          <div className="font-semibold text-foreground/80">
            torchvision.models.resnet18()
          </div>
          <div className="font-mono text-foreground/55">
            {TOTAL_PARAMS.toLocaleString()} params · {formatParams(TOTAL_PARAMS)}
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
}

export function ResNet18Diagram() {
  const [selectedId, setSelectedId] = useState<string | null>("bb-2-0");
  const [hoverId, setHoverId] = useState<string | null>(null);

  const activeId = hoverId ?? selectedId;
  const activeSpec = useMemo(
    () => RESNET18_SPEC.find((n) => n.id === activeId) ?? null,
    [activeId],
  );

  // The tutorial container is max-w-4xl (~848px inner). A side-by-side layout
  // with a 320px info card would leave the diagram cramped, so on lg+ screens
  // we break out of the container with negative margins to claim more width.
  return (
    <figure className="my-8 lg:-mx-20 xl:-mx-32">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[620px] overflow-hidden rounded-xl border border-border/60 bg-muted/20">
          <ReactFlowProvider>
            <FlowCanvas
              selectedId={selectedId}
              onSelect={setSelectedId}
              onHoverChange={setHoverId}
            />
          </ReactFlowProvider>
        </div>
        <InfoCard spec={activeSpec} onClear={() => setSelectedId(null)} />
      </div>
    </figure>
  );
}
