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

const DATASETS = [
  { value: "randn", label: "randn" },
  { value: "circle", label: "Circle" },
  { value: "xor", label: "XOR" },
  { value: "gaussian", label: "Gaussian" },
  { value: "spiral", label: "Spiral" },
] as const;

type DatasetValue = (typeof DATASETS)[number]["value"];

const LEARNING_RATES = [0.0001, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10];
const ACTIVATIONS = ["ReLU", "Tanh", "Sigmoid", "Linear"] as const;
const LOSS_FNS = ["MSE"] as const;
const OPTIMIZERS = ["SGD"] as const;
const BATCH_SIZES = [1, 64];

type Activation = (typeof ACTIVATIONS)[number];
type LossFn = (typeof LOSS_FNS)[number];
type Optimizer = (typeof OPTIMIZERS)[number];

export function MLPDiagram() {
  const [inputCount, setInputCount] = useState(4);
  const [hiddenCount, setHiddenCount] = useState(6);
  const [outputCount, setOutputCount] = useState(2);
  const [dataset, setDataset] = useState<DatasetValue>("randn");
  const [learningRate, setLearningRate] = useState(0.03);
  const [activation, setActivation] = useState<Activation>("Tanh");
  const [lossFn, setLossFn] = useState<LossFn>("MSE");
  const [optimizer, setOptimizer] = useState<Optimizer>("SGD");
  const [epochs, setEpochs] = useState(100);
  const [sampleSize, setSampleSize] = useState(512);
  const [batchSize, setBatchSize] = useState(32);
  const [lossCurve, setLossCurve] = useState<number[]>([]);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);

  async function handleTrain() {
    setTraining(true);
    setTrainError(null);
    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          input_count: inputCount,
          hidden_count: hiddenCount,
          output_count: outputCount,
          learning_rate: learningRate,
          activation,
          loss_fn: lossFn,
          optimizer,
          batch_size: batchSize,
          epochs,
          sample_size: sampleSize,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { loss_curve: number[]; final_loss: number };
      setLossCurve(data.loss_curve);
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : "Training failed");
    } finally {
      setTraining(false);
    }
  }

  function handleReset() {
    setLossCurve([]);
    setTrainError(null);
  }

  const finalLoss = lossCurve.length ? lossCurve[lossCurve.length - 1] : null;
  const lossPolyline = (() => {
    if (lossCurve.length < 2) return "";
    const max = Math.max(...lossCurve);
    const min = Math.min(...lossCurve);
    const range = Math.max(max - min, 1e-9);
    return lossCurve
      .map((v, i) => {
        const x = (i / (lossCurve.length - 1)) * 100;
        const y = 38 - ((v - min) / range) * 34;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  })();

  const inputX = layerX(0, 3);
  const hiddenX = layerX(1, 3);
  const outputX = layerX(2, 3);

  const inputs = neuronPositions(inputCount, inputX);
  const hidden = neuronPositions(hiddenCount, hiddenX);
  const outputs = neuronPositions(outputCount, outputX);

  return (
    <>
    <div className="not-prose mt-8 flex flex-wrap items-end gap-6 border-y border-border py-4">
      <div className="flex items-center gap-3 self-end pb-0.5">
        <button
          type="button"
          onClick={handleReset}
          disabled={training}
          aria-label="Reset training"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-accent/10 hover:text-foreground disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 4 3 10 9 10" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleTrain}
          disabled={training}
          aria-label={training ? "Training" : "Start training"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
            <polygon points="7,5 20,12 7,19" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="lr-select" className="text-xs font-medium text-foreground/70">
          Learning rate
        </label>
        <select
          id="lr-select"
          value={learningRate}
          onChange={(e) => setLearningRate(Number(e.target.value))}
          aria-label="Learning rate"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/10 focus:border-accent focus:outline-none"
        >
          {LEARNING_RATES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="activation-select" className="text-xs font-medium text-foreground/70">
          Activation
        </label>
        <select
          id="activation-select"
          value={activation}
          onChange={(e) => setActivation(e.target.value as Activation)}
          aria-label="Activation function"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/10 focus:border-accent focus:outline-none"
        >
          {ACTIVATIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="loss-select" className="text-xs font-medium text-foreground/70">
          Loss function
        </label>
        <select
          id="loss-select"
          value={lossFn}
          onChange={(e) => setLossFn(e.target.value as LossFn)}
          aria-label="Loss function"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/10 focus:border-accent focus:outline-none"
        >
          {LOSS_FNS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="optimizer-select" className="text-xs font-medium text-foreground/70">
          Optimizer
        </label>
        <select
          id="optimizer-select"
          value={optimizer}
          onChange={(e) => setOptimizer(e.target.value as Optimizer)}
          aria-label="Optimizer"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/10 focus:border-accent focus:outline-none"
        >
          {OPTIMIZERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="epochs-input" className="text-xs font-medium text-foreground/70">
          Epoch
        </label>
        <input
          id="epochs-input"
          type="number"
          min={1}
          max={1000}
          step={1}
          value={epochs}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setEpochs(Math.max(1, Math.min(1000, Math.round(n))));
          }}
          aria-label="Number of epochs"
          className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/10 focus:border-accent focus:outline-none"
        />
      </div>
    </div>
    <figure className="not-prose my-8 flex flex-col items-start gap-4 md:flex-row md:items-start md:gap-6">
      <aside className="flex w-full shrink-0 flex-col gap-2 md:w-44 md:self-center">
        <label htmlFor="dataset-select" className="font-mono text-xs font-medium text-foreground/70">
          X
        </label>
        <select
          id="dataset-select"
          value={dataset}
          onChange={(e) => setDataset(e.target.value as DatasetValue)}
          aria-label="Select dataset"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-accent/10 focus:border-accent focus:outline-none"
        >
          {DATASETS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <label htmlFor="sample-input" className="mt-2 text-xs font-medium text-foreground/70">
          Sample size
        </label>
        <input
          id="sample-input"
          type="number"
          min={16}
          max={4096}
          step={16}
          value={sampleSize}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setSampleSize(Math.max(16, Math.min(4096, Math.round(n))));
          }}
          aria-label="Sample size"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/10 focus:border-accent focus:outline-none"
        />
        <label htmlFor="batch-select" className="mt-2 text-xs font-medium text-foreground/70">
          Batch size: {batchSize}
        </label>
        <input
          id="batch-select"
          type="range"
          min={BATCH_SIZES[0]}
          max={BATCH_SIZES[BATCH_SIZES.length - 1]}
          step={1}
          value={batchSize}
          onChange={(e) => setBatchSize(Number(e.target.value))}
          aria-label="Batch size"
          className="accent-accent"
        />
      </aside>
      <div className="flex flex-1 flex-col items-center gap-4">
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

        <g className="fill-foreground/70 font-mono" fontSize={11}>
          {inputs.map((p, i) => (
            <text
              key={`in-lbl-${i}`}
              x={p.x - NEURON_RADIUS - 8}
              y={p.y}
              textAnchor="end"
              dominantBaseline="middle"
            >
              X{inputs.length > 1 ? <tspan dy={3} fontSize={8}>{i + 1}</tspan> : null}
            </text>
          ))}
          {outputs.map((p, i) => (
            <text
              key={`out-lbl-${i}`}
              x={p.x + NEURON_RADIUS + 8}
              y={p.y}
              textAnchor="start"
              dominantBaseline="middle"
            >
              y{outputs.length > 1 ? <tspan dy={3} fontSize={8}>{i + 1}</tspan> : null}
            </text>
          ))}
        </g>
      </svg>
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-2 md:w-44 md:self-center">
        <span className="text-xs font-medium text-foreground/70">Output</span>
        <div className="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground/70">Training loss</span>
            <span className="font-mono">{finalLoss !== null ? finalLoss.toFixed(3) : "—"}</span>
          </div>
        </div>
        <svg viewBox="0 0 100 40" className="w-full" role="img" aria-label="Training loss curve">
          {lossPolyline && (
            <polyline
              points={lossPolyline}
              fill="none"
              stroke="currentColor"
              className="text-accent"
              strokeWidth={1.5}
            />
          )}
        </svg>
        {trainError && (
          <span className="text-xs text-red-500" role="alert">
            {trainError}
          </span>
        )}
      </aside>
    </figure>
    </>
  );
}
