"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { codeToHtml } from "shiki";

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

function niceYTicks(min: number, max: number): number[] {
  const range = max - min;
  if (range < 1e-9) return [min];
  const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  const target = range / 4;
  const step = steps.find((s) => s >= target) ?? steps[steps.length - 1];
  // Round min down and max up to the nearest step
  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= last + step * 0.01; v += step) {
    ticks.push(v);
    if (ticks.length >= 6) break;
  }
  return ticks;
}

function LossChart({
  fullCurve,
  fullTestCurve,
  visibleCurve,
  visibleTestCurve,
}: {
  fullCurve: number[];
  fullTestCurve: number[];
  visibleCurve: number[];
  visibleTestCurve: number[];
}) {
  const LEFT = 28;
  const RIGHT = 290;
  const TOP = 8;
  const BOTTOM = 158;
  const PW = RIGHT - LEFT;
  const PH = BOTTOM - TOP;

  const allValues = [...fullCurve, ...fullTestCurve];
  const hasData = fullCurve.length >= 2;
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const dataMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const totalEpochs = fullCurve.length;

  // Use niceYTicks to determine the actual axis range (may be wider than data)
  const yTickValues = niceYTicks(dataMin, dataMax);
  const axisMin = yTickValues[0];
  const axisMax = yTickValues[yTickValues.length - 1];
  const axisRange = Math.max(axisMax - axisMin, 1e-9);

  // Y-axis ticks — deduplicated by formatted label, using axis range
  const formatY = (v: number) =>
    v < 0.01 ? v.toExponential(0) : v < 1 ? v.toFixed(2) : v.toFixed(1);
  const seenLabels = new Set<string>();
  const yTicks = yTickValues
    .map((value) => ({
      value,
      label: formatY(value),
      y: TOP + (1 - (value - axisMin) / axisRange) * PH,
    }))
    .filter((t) => {
      if (seenLabels.has(t.label)) return false;
      seenLabels.add(t.label);
      return true;
    });

  // Build polylines using the same axis scale as the ticks
  const toPolyline = (visible: number[], full: number[]) => {
    if (visible.length < 2) return "";
    return visible
      .map((v, i) => {
        const x = LEFT + (i / (full.length - 1)) * PW;
        const y = TOP + (1 - (v - axisMin) / axisRange) * PH;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  };
  const lossPolyline = toPolyline(visibleCurve, fullCurve);
  const testLossPolyline = toPolyline(visibleTestCurve, fullTestCurve);

  // X-axis ticks — target ~5 ticks max, pick a nice step
  const xSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const xTarget = totalEpochs / 5;
  const xStep = xSteps.find((s) => s >= xTarget) ?? xSteps[xSteps.length - 1];
  const xTicks: { epoch: number; x: number }[] = [];
  if (totalEpochs > 0) {
    const lastEpoch = totalEpochs;
    for (let e = 0; e <= lastEpoch; e += xStep) {
      xTicks.push({ epoch: e, x: LEFT + (e / (totalEpochs - 1)) * PW });
    }
    if (!xTicks.some((t) => t.epoch === lastEpoch)) {
      const finalX = LEFT + (lastEpoch / (totalEpochs - 1)) * PW;
      if (xTicks.length > 0 && finalX - xTicks[xTicks.length - 1].x < PW * 0.08) {
        xTicks.pop();
      }
      xTicks.push({ epoch: lastEpoch, x: finalX });
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
            {t.label}
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

      {/* Train loss curve */}
      {lossPolyline && (
        <polyline
          points={lossPolyline}
          fill="none"
          stroke="currentColor"
          className="text-accent"
          strokeWidth={1.5}
        />
      )}

      {/* Test loss curve */}
      {testLossPolyline && (
        <polyline
          points={testLossPolyline}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      )}

      {/* Current point dots */}
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
      {testLossPolyline && (() => {
        const lastPt = testLossPolyline.split(" ").pop()!.split(",");
        return (
          <circle
            cx={Number(lastPt[0])}
            cy={Number(lastPt[1])}
            r={2.5}
            fill="#f59e0b"
          />
        );
      })()}

      {/* Legend */}
      {hasData && (
        <g fontSize={7} dominantBaseline="middle">
          <rect x={RIGHT - 74} y={TOP} width={48} height={22} rx={2} className="fill-background" opacity={0.85} />
          <line x1={RIGHT - 70} x2={RIGHT - 58} y1={TOP + 7} y2={TOP + 7} stroke="currentColor" className="text-accent" strokeWidth={1.5} />
          <text x={RIGHT - 55} y={TOP + 7} className="fill-foreground/60">Train</text>
          <line x1={RIGHT - 70} x2={RIGHT - 58} y1={TOP + 17} y2={TOP + 17} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
          <text x={RIGHT - 55} y={TOP + 17} className="fill-foreground/60">Test</text>
        </g>
      )}
    </svg>
  );
}

function generatePytorchCode(params: {
  dataset: DatasetValue;
  inputCount: number;
  hiddenCount: number;
  outputCount: number;
  learningRate: number;
  activation: Activation;
  lossFn: LossFn;
  optimizer: Optimizer;
  batchSize: number;
  epochs: number;
  sampleSize: number;
  testPct: number;
}): string {
  const {
    dataset,
    inputCount,
    hiddenCount,
    outputCount,
    learningRate,
    activation,
    batchSize,
    epochs,
    sampleSize,
    testPct,
  } = params;

  const activationMap: Record<Activation, string> = {
    ReLU: "nn.ReLU()",
    Tanh: "nn.Tanh()",
    Sigmoid: "nn.Sigmoid()",
    Linear: "nn.Identity()",
  };
  const act = activationMap[activation];

  const datasetBlocks: Record<DatasetValue, string> = {
    randn: `X = torch.randn(N, input_dim)
Y = torch.randn(N, output_dim)`,
    circle: `t = torch.linspace(0, 2 * torch.pi, N)
X = torch.stack([torch.cos(t), torch.sin(t)], dim=1)${inputCount > 2 ? `\nX = torch.cat([X, torch.randn(N, input_dim - 2)], dim=1)` : ""}
Y = (X[:, 0:1] ** 2 + X[:, 1:2] ** 2).expand(-1, output_dim)`,
    xor: `X = torch.randint(0, 2, (N, input_dim)).float()
Y = (X[:, 0:1] * X[:, 1:2]${inputCount < 2 ? "" : ""}).expand(-1, output_dim).float()`,
    gaussian: `X = torch.randn(N, input_dim)
Y = torch.exp(-X[:, 0:1] ** 2).expand(-1, output_dim)`,
    spiral: `t = torch.linspace(0, 4 * torch.pi, N)
r = t / (4 * torch.pi)
X = torch.stack([r * torch.cos(t), r * torch.sin(t)], dim=1)${inputCount > 2 ? `\nX = torch.cat([X, torch.randn(N, input_dim - 2)], dim=1)` : ""}
X = X + torch.randn_like(X) * 0.05
Y = (t / (4 * torch.pi)).unsqueeze(1).expand(-1, output_dim)`,
  };

  return `import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

# ── Hyperparameters ──────────────────────────────────────
input_dim   = ${inputCount}
hidden_dim  = ${hiddenCount}
output_dim  = ${outputCount}
lr          = ${learningRate}
epochs      = ${epochs}
batch_size  = ${batchSize}
N           = ${sampleSize}

torch.manual_seed(42)

# ── Dataset: ${dataset} ──────────────────────────────────
${datasetBlocks[dataset]}

# ── Train / Test split (${100 - testPct}/${testPct}) ─────────────────────────
split = int(N * ${((100 - testPct) / 100).toFixed(2)})
perm_all = torch.randperm(N)
X_train, Y_train = X[perm_all[:split]], Y[perm_all[:split]]
X_test,  Y_test  = X[perm_all[split:]], Y[perm_all[split:]]

# ── Dataset & DataLoader ────────────────────────────────
class TensorPairDataset(Dataset):
    def __init__(self, features, targets):
        self.features = features
        self.targets = targets

    def __len__(self):
        return len(self.features)

    def __getitem__(self, idx):
        return self.features[idx], self.targets[idx]

train_ds = TensorPairDataset(X_train, Y_train)
test_ds  = TensorPairDataset(X_test, Y_test)

train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
test_loader  = DataLoader(test_ds,  batch_size=batch_size, shuffle=False)

# ── Model ────────────────────────────────────────────────
model = nn.Sequential(
    nn.Linear(input_dim, hidden_dim),
    ${act},
    nn.Linear(hidden_dim, output_dim),
)

criterion = nn.MSELoss()
optimizer = torch.optim.SGD(model.parameters(), lr=lr)

# ── Training loop ────────────────────────────────────────
train_loss_curve = []
test_loss_curve = []

for epoch in range(epochs):
    model.train()
    epoch_loss = 0.0
    n_batches = 0

    for xb, yb in train_loader:
        pred = model(xb)
        loss = criterion(pred, yb)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        epoch_loss += loss.item()
        n_batches += 1

    avg_loss = epoch_loss / max(n_batches, 1)
    train_loss_curve.append(avg_loss)

    model.eval()
    test_epoch_loss = 0.0
    test_batches = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            test_loss = criterion(model(xb), yb).item()
            test_epoch_loss += test_loss
            test_batches += 1
    test_loss_curve.append(test_epoch_loss / max(test_batches, 1))

    if (epoch + 1) % ${Math.max(1, Math.round(epochs / 10))} == 0:
        print(f"Epoch {epoch + 1:>4d}/{epochs}  Train: {avg_loss:.6f}  Test: {test_loss_curve[-1]:.6f}")

print(f"\\nFinal train loss: {train_loss_curve[-1]:.6f}")
print(f"Final test loss:  {test_loss_curve[-1]:.6f}")`;
}

function HighlightedCode({ code }: { code: string }) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: "python",
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    }).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => { cancelled = true; };
  }, [code]);

  if (!html) {
    // Fallback while Shiki loads
    return (
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="overflow-x-auto [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:bg-transparent!"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy code to clipboard"
      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground/70 transition hover:bg-accent/10 hover:text-foreground"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
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
  const [testPct, setTestPct] = useState(20);
  const [fullCurve, setFullCurve] = useState<number[]>([]);
  const [fullTestCurve, setFullTestCurve] = useState<number[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [displayLoss, setDisplayLoss] = useState<number | null>(null);
  const [displayTestLoss, setDisplayTestLoss] = useState<number | null>(null);
  const [training, setTraining] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [codeWidth, setCodeWidth] = useState(0);
  const showCode = codeWidth > 0;
  const CODE_DEFAULT = 512;
  const CODE_MIN = 360;
  const CODE_MAX = typeof window !== "undefined" ? window.innerWidth * 0.8 : 1200;
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const animRef = useRef<number>(0);
  const displayLossRef = useRef<number | null>(null);
  const displayTestLossRef = useRef<number | null>(null);
  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
  }, []);

  const animateCurve = useCallback((curve: number[], testCurve: number[]) => {
    stopAnimation();
    if (curve.length === 0) return;

    const totalDuration = Math.min(2000, curve.length * 30);
    const start = performance.now();
    displayLossRef.current = null;
    displayTestLossRef.current = null;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / totalDuration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const count = Math.max(1, Math.round(eased * curve.length));
      setVisibleCount(count);

      // animate the displayed numeric train loss
      const currentLoss = curve[count - 1];
      const prevLoss = displayLossRef.current;
      if (prevLoss === null) {
        displayLossRef.current = currentLoss;
        setDisplayLoss(currentLoss);
      } else {
        const lerped = prevLoss + (currentLoss - prevLoss) * 0.3;
        displayLossRef.current = lerped;
        setDisplayLoss(lerped);
      }

      // animate the displayed numeric test loss
      if (testCurve.length > 0) {
        const currentTestLoss = testCurve[count - 1];
        const prevTestLoss = displayTestLossRef.current;
        if (prevTestLoss === null) {
          displayTestLossRef.current = currentTestLoss;
          setDisplayTestLoss(currentTestLoss);
        } else {
          const lerped = prevTestLoss + (currentTestLoss - prevTestLoss) * 0.3;
          displayTestLossRef.current = lerped;
          setDisplayTestLoss(lerped);
        }
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        // snap to final values
        setVisibleCount(curve.length);
        setDisplayLoss(curve[curve.length - 1]);
        if (testCurve.length > 0) {
          setDisplayTestLoss(testCurve[testCurve.length - 1]);
        }
        displayLossRef.current = null;
        displayTestLossRef.current = null;
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
    setFullTestCurve([]);
    setVisibleCount(0);
    setDisplayLoss(null);
    setDisplayTestLoss(null);
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
          train_ratio: (100 - testPct) / 100,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        loss_curve: number[];
        test_loss_curve: number[];
        final_loss: number;
        final_test_loss: number;
      };
      setFullCurve(data.loss_curve);
      setFullTestCurve(data.test_loss_curve);
      animateCurve(data.loss_curve, data.test_loss_curve);
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : "Training failed");
    } finally {
      setTraining(false);
    }
  }

  function handleReset() {
    stopAnimation();
    setFullCurve([]);
    setFullTestCurve([]);
    setVisibleCount(0);
    setDisplayLoss(null);
    setDisplayTestLoss(null);
    setTrainError(null);
  }

  // Derive visible slices for rendering
  const visibleCurve = fullCurve.slice(0, visibleCount);
  const visibleTestCurve = fullTestCurve.slice(0, visibleCount);

  const inputX = layerX(0, 3);
  const hiddenX = layerX(1, 3);
  const outputX = layerX(2, 3);

  const inputs = neuronPositions(inputCount, inputX);
  const hidden = neuronPositions(hiddenCount, hiddenX);
  const outputs = neuronPositions(outputCount, outputX);

  return (
    <>
    <div>
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
        <label htmlFor="ratio-select" className="mt-2 text-xs font-medium text-foreground/70">
          Test: {testPct}%
        </label>
        <input
          id="ratio-select"
          type="range"
          min={10}
          max={90}
          step={5}
          value={testPct}
          onChange={(e) => setTestPct(Number(e.target.value))}
          aria-label="Test set percentage"
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
            <span className="text-foreground/70">Train loss</span>
            <span className="font-mono">{displayLoss !== null ? displayLoss.toFixed(3) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/70">Test loss</span>
            <span className="font-mono">{displayTestLoss !== null ? displayTestLoss.toFixed(3) : "—"}</span>
          </div>
        </div>
        {trainError && (
          <span className="text-xs text-red-500" role="alert">
            {trainError}
          </span>
        )}
      </aside>
    </figure>
    <div className="not-prose my-8 w-full max-w-3xl">
      <LossChart
        fullCurve={fullCurve}
        fullTestCurve={fullTestCurve}
        visibleCurve={visibleCurve}
        visibleTestCurve={visibleTestCurve}
      />
    </div>
    </div>
    {/* PyTorch code sidebar */}
    {(() => {
      const code = generatePytorchCode({
        dataset,
        inputCount,
        hiddenCount,
        outputCount,
        learningRate,
        activation,
        lossFn,
        optimizer,
        batchSize,
        epochs,
        sampleSize,
        testPct,
      });
      return (
        <>
          {/* Edge tab — fixed to right edge, always visible, vertically centered */}
          <button
            type="button"
            onClick={() => setCodeWidth((w) => (w > 0 ? 0 : CODE_DEFAULT))}
            aria-expanded={showCode}
            aria-controls="pytorch-code-sidebar"
            aria-label={showCode ? "Close PyTorch code" : "Show PyTorch code"}
            className="fixed top-1/2 z-50 flex h-28 w-10 -translate-y-1/2 flex-col items-center justify-center gap-1.5 rounded-l-lg border border-r-0 border-border bg-background text-foreground/70 shadow-lg hover:bg-accent/10 hover:text-foreground"
            style={{ right: showCode ? `${codeWidth}px` : 0 }}
          >
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>

{/* Sidebar panel */}
          <aside
            id="pytorch-code-sidebar"
            className={`fixed top-0 right-0 z-50 flex h-full flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out ${
              showCode ? "translate-x-0" : "translate-x-full"
            }`}
            style={{ width: `${codeWidth || CODE_DEFAULT}px` }}
            aria-label="PyTorch code sidebar"
          >
            {/* Drag handle */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                dragRef.current = { startX: e.clientX, startW: codeWidth };
                const onMove = (ev: MouseEvent) => {
                  if (!dragRef.current) return;
                  const delta = dragRef.current.startX - ev.clientX;
                  const next = Math.min(CODE_MAX, Math.max(CODE_MIN, dragRef.current.startW + delta));
                  setCodeWidth(next);
                };
                const onUp = () => {
                  dragRef.current = null;
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                  document.body.style.cursor = "";
                  document.body.style.userSelect = "";
                };
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
              className="absolute top-0 left-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors"
              aria-label="Resize sidebar"
              role="separator"
            />
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  PyTorch Code
                </span>
                <span className="text-xs text-foreground/50">
                  Paste into a Jupyter notebook to reproduce
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={code} />
                <button
                  type="button"
                  onClick={() => setCodeWidth(0)}
                  aria-label="Close sidebar"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 transition hover:bg-accent/10 hover:text-foreground"
                >
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1={18} y1={6} x2={6} y2={18} />
                    <line x1={6} y1={6} x2={18} y2={18} />
                  </svg>
                </button>
              </div>
            </div>

            {/* Code body */}
            <div className="flex-1 overflow-y-auto">
              <HighlightedCode code={code} />
            </div>
          </aside>
        </>
      );
    })()}
    </>
  );
}
