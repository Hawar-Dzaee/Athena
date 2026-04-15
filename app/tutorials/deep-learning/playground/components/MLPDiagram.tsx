"use client";

import { useState } from "react";

const MIN_NEURONS = 1;
const MAX_NEURONS = 8;

const WIDTH = 640;
const HEIGHT = 420;
const PADDING_X = 80;
const NEURON_RADIUS = 18;

function layerX(index: number, total: number): number {
  if (total === 1) return WIDTH / 2;
  const usable = WIDTH - PADDING_X * 2;
  return PADDING_X + (usable * index) / (total - 1);
}

function neuronPositions(count: number, x: number): { x: number; y: number }[] {
  const spacing = HEIGHT / (count + 1);
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: spacing * (i + 1),
  }));
}

function curvePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}

function LayerControl({
  label,
  count,
  setCount,
}: {
  label: string;
  count: number;
  setCount: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-foreground/70">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCount(Math.max(MIN_NEURONS, count - 1))}
          disabled={count <= MIN_NEURONS}
          aria-label={`Decrease ${label} neurons`}
          className="h-7 w-7 rounded-full border border-border text-foreground/80 transition hover:bg-accent/10 disabled:opacity-30"
        >
          −
        </button>
        <span className="w-5 text-center font-mono text-sm">{count}</span>
        <button
          type="button"
          onClick={() => setCount(Math.min(MAX_NEURONS, count + 1))}
          disabled={count >= MAX_NEURONS}
          aria-label={`Increase ${label} neurons`}
          className="h-7 w-7 rounded-full border border-border text-foreground/80 transition hover:bg-accent/10 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function MLPDiagram() {
  const [inputCount, setInputCount] = useState(4);
  const [hiddenCount, setHiddenCount] = useState(6);
  const [outputCount, setOutputCount] = useState(2);

  const inputX = layerX(0, 3);
  const hiddenX = layerX(1, 3);
  const outputX = layerX(2, 3);

  const inputs = neuronPositions(inputCount, inputX);
  const hidden = neuronPositions(hiddenCount, hiddenX);
  const outputs = neuronPositions(outputCount, outputX);

  return (
    <figure className="not-prose my-8 flex flex-col items-center gap-4">
      <div className="grid w-full max-w-3xl grid-cols-3 gap-4 px-4">
        <LayerControl label="Input" count={inputCount} setCount={setInputCount} />
        <LayerControl label="Hidden" count={hiddenCount} setCount={setHiddenCount} />
        <LayerControl label="Output" count={outputCount} setCount={setOutputCount} />
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-3xl"
        role="img"
        aria-label="Multi-layer perceptron with input, hidden, and output layers"
      >
        <g stroke="currentColor" className="text-border" strokeWidth={1} fill="none" opacity={0.6}>
          {inputs.map((a, i) =>
            hidden.map((b, j) => (
              <path key={`ih-${i}-${j}`} d={curvePath(a, b)} />
            )),
          )}
          {hidden.map((a, i) =>
            outputs.map((b, j) => (
              <path key={`ho-${i}-${j}`} d={curvePath(a, b)} />
            )),
          )}
        </g>

        <g>
          {inputs.map((p, i) => (
            <circle
              key={`in-${i}`}
              cx={p.x}
              cy={p.y}
              r={NEURON_RADIUS}
              className="fill-background stroke-accent"
              strokeWidth={2}
            />
          ))}
          {hidden.map((p, i) => (
            <circle
              key={`hd-${i}`}
              cx={p.x}
              cy={p.y}
              r={NEURON_RADIUS}
              className="fill-background stroke-accent"
              strokeWidth={2}
            />
          ))}
          {outputs.map((p, i) => (
            <circle
              key={`out-${i}`}
              cx={p.x}
              cy={p.y}
              r={NEURON_RADIUS}
              className="fill-background stroke-accent"
              strokeWidth={2}
            />
          ))}
        </g>
      </svg>

    </figure>
  );
}
