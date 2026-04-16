"use client";

import { useState, useRef, useCallback, useEffect } from "react";

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

function niceTickCount(range: number): number[] {
  // Return 3–5 evenly-spaced tick values for a given [min,max]
  const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  const target = range / 4;
  const step = steps.find((s) => s >= target) ?? steps[steps.length - 1];
  const ticks: number[] = [];
  const start = 0;
  for (let v = start; v <= range * 1.01; v += step) {
    ticks.push(v);
    if (ticks.length >= 6) break;
  }
  return ticks;
}

function LossChart({
  fullCurve,
  visibleCurve,
  lossPolyline,
}: {
  fullCurve: number[];
  visibleCurve: number[];
  lossPolyline: string;
}) {
  const LEFT = 28;
  const RIGHT = 290;
  const TOP = 8;
  const BOTTOM = 158;
  const PW = RIGHT - LEFT;
  const PH = BOTTOM - TOP;

  const hasData = fullCurve.length >= 2;
  const maxLoss = hasData ? Math.max(...fullCurve) : 1;
  const minLoss = hasData ? Math.min(...fullCurve) : 0;
  const lossRange = Math.max(maxLoss - minLoss, 1e-9);
  const totalEpochs = fullCurve.length;

  // Y-axis ticks (loss values)
  const yRaw = niceTickCount(lossRange);
  const yTicks = yRaw.map((offset) => ({
    value: minLoss + offset,
    y: TOP + (1 - offset / lossRange) * PH,
  }));

  // X-axis ticks (epoch numbers)
  const xStep = totalEpochs <= 10 ? 1 : totalEpochs <= 50 ? 10 : totalEpochs <= 200 ? 25 : 50;
  const xTicks: { epoch: number; x: number }[] = [];
  if (totalEpochs > 0) {
    for (let e = 0; e <= totalEpochs; e += xStep) {
      xTicks.push({ epoch: e, x: LEFT + (e / (totalEpochs - 1)) * PW });
    }
    // always include the last epoch
    const last = totalEpochs - 1;
    if (!xTicks.some((t) => t.epoch === last)) {
      xTicks.push({ epoch: last + 1, x: RIGHT });
    }
  }

  const labelSize = 7;
  const tickSize = 6;

  return (
    <svg viewBox="0 0 300 180" className="w-full" role="img" aria-label="Training loss curve">
      {/* Grid lines */}
      <g stroke="currentColor" className="text-border" strokeWidth={0.3} opacity={0.5}>
        {yTicks.map((t, i) => (
          <line key={`yg-${i}`} x1={LEFT} x2={RIGHT} y1={t.y} y2={t.y} />
        ))}
        {xTicks.map((t, i) => (
          <line key={`xg-${i}`} x1={t.x} x2={t.x} y1={TOP} y2={BOTTOM} />
        ))}
      </g>

      {/* Axes */}
      <g stroke="currentColor" className="text-foreground/50" strokeWidth={0.4} fill="none">
        <line x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} />
        <line x1={LEFT} x2={LEFT} y1={TOP} y2={BOTTOM} />
      </g>

      {/* Y-axis tick labels */}
      <g className="fill-foreground/50" fontSize={tickSize} textAnchor="end" dominantBaseline="middle">
        {yTicks.map((t, i) => (
          <text key={`yl-${i}`} x={LEFT - 4} y={t.y}>
            {t.value < 0.01 ? t.value.toExponential(0) : t.value < 1 ? t.value.toFixed(2) : t.value.toFixed(1)}
          </text>
        ))}
      </g>

      {/* X-axis tick labels */}
      <g className="fill-foreground/50" fontSize={tickSize} textAnchor="middle" dominantBaseline="hanging">
        {xTicks.map((t, i) => (
          <text key={`xl-${i}`} x={t.x} y={BOTTOM + 4}>
            {t.epoch}
          </text>
        ))}
      </g>

      {/* Axis labels */}
      <text
        x={(LEFT + RIGHT) / 2}
        y={BOTTOM + 17}
        className="fill-foreground/60"
        fontSize={labelSize}
        textAnchor="middle"
      >
        Epoch
      </text>
      <text
        x={5}
        y={(TOP + BOTTOM) / 2}
        className="fill-foreground/60"
        fontSize={labelSize}
        textAnchor="middle"
        transform={`rotate(-90, 5, ${(TOP + BOTTOM) / 2})`}
      >
        Loss
      </text>

      {/* Loss curve */}
      {lossPolyline && (
        <polyline
          points={lossPolyline}
          fill="none"
          stroke="currentColor"
          className="text-accent"
          strokeWidth={1.5}
        />
      )}

      {/* Current point dot */}
      {visibleCurve.length >= 1 && lossPolyline && (() => {
        const lastPt = lossPolyline.split(" ").pop()!.split(",");
        return (
          <circle
            cx={Number(lastPt[0])}
            cy={Number(lastPt[1])}
            r={2.5}
            className="fill-accent"
          />
        );
      })()}
    </svg>
  );
}

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
  const [fullCurve, setFullCurve] = useState<number[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [displayLoss, setDisplayLoss] = useState<number | null>(null);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);
  const animRef = useRef<number>(0);
  const displayLossRef = useRef<number | null>(null);

  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
  }, []);

  const animateCurve = useCallback((curve: number[]) => {
    stopAnimation();
    if (curve.length === 0) return;

    const totalDuration = Math.min(2000, curve.length * 30);
    const start = performance.now();
    displayLossRef.current = null;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / totalDuration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const count = Math.max(1, Math.round(eased * curve.length));
      setVisibleCount(count);

      // animate the displayed numeric loss
      const currentLoss = curve[count - 1];
      const prevLoss = displayLossRef.current;
      if (prevLoss === null) {
        displayLossRef.current = currentLoss;
        setDisplayLoss(currentLoss);
      } else {
        // smooth interpolation toward actual value
        const lerped = prevLoss + (currentLoss - prevLoss) * 0.3;
        displayLossRef.current = lerped;
        setDisplayLoss(lerped);
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        // snap to final values
        setVisibleCount(curve.length);
        setDisplayLoss(curve[curve.length - 1]);
        displayLossRef.current = null;
        animRef.current = 0;
      }
    }

    animRef.current = requestAnimationFrame(tick);
  }, [stopAnimation]);

  useEffect(() => stopAnimation, [stopAnimation]);

  async function handleTrain() {
    setTraining(true);
    setTrainError(null);
    stopAnimation();
    setFullCurve([]);
    setVisibleCount(0);
    setDisplayLoss(null);
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
      setFullCurve(data.loss_curve);
      animateCurve(data.loss_curve);
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : "Training failed");
    } finally {
      setTraining(false);
    }
  }

  function handleReset() {
    stopAnimation();
    setFullCurve([]);
    setVisibleCount(0);
    setDisplayLoss(null);
    setTrainError(null);
  }

  // Derive visible slice for rendering
  const visibleCurve = fullCurve.slice(0, visibleCount);

  // Chart plot area constants (must match LossChart)
  const CHART_LEFT = 28;
  const CHART_RIGHT = 290;
  const CHART_TOP = 8;
  const CHART_BOTTOM = 158;
  const PLOT_W = CHART_RIGHT - CHART_LEFT;
  const PLOT_H = CHART_BOTTOM - CHART_TOP;

  const lossPolyline = (() => {
    if (visibleCurve.length < 2) return "";
    const max = Math.max(...fullCurve);
    const min = Math.min(...fullCurve);
    const range = Math.max(max - min, 1e-9);
    return visibleCurve
      .map((v, i) => {
        const x = CHART_LEFT + (i / (fullCurve.length - 1)) * PLOT_W;
        const y = CHART_TOP + (1 - (v - min) / range) * PLOT_H;
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
            <span className="text-foreground/70">Epoch</span>
            <span className="font-mono">{visibleCount > 0 ? `${visibleCount}/${fullCurve.length}` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/70">Training loss</span>
            <span className="font-mono">{displayLoss !== null ? displayLoss.toFixed(3) : "—"}</span>
          </div>
        </div>
        {trainError && (
          <span className="text-xs text-red-500" role="alert">
            {trainError}
          </span>
        )}
      </aside>
    </figure>
    <div className="not-prose my-8 mx-auto w-full max-w-3xl">
      <LossChart
        fullCurve={fullCurve}
        visibleCurve={visibleCurve}
        lossPolyline={lossPolyline}
      />
    </div>
    </>
  );
}
