import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { createInterface } from "readline";

const SENTINEL = "---ATHENA_REPL_DONE---";
const REPL_SCRIPT = path.join(process.cwd(), "scripts", "repl.py");

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    dataset: string;
    input_count: number;
    hidden_count: number;
    output_count: number;
    learning_rate: number;
    activation: string;
    loss_fn: string;
    optimizer: string;
    batch_size: number;
    epochs: number;
    sample_size: number;
  };

  const code = buildTrainScript(body);

  try {
    const result = await runPython(code);

    if (result.stderr) {
      return NextResponse.json(
        { error: result.stderr },
        { status: 500 },
      );
    }

    const parsed = JSON.parse(result.stdout.trim());
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Training failed" },
      { status: 500 },
    );
  }
}

function buildTrainScript(p: {
  dataset: string;
  input_count: number;
  hidden_count: number;
  output_count: number;
  learning_rate: number;
  activation: string;
  loss_fn: string;
  optimizer: string;
  batch_size: number;
  epochs: number;
  sample_size: number;
}): string {
  const activationMap: Record<string, string> = {
    ReLU: "nn.ReLU()",
    Tanh: "nn.Tanh()",
    Sigmoid: "nn.Sigmoid()",
    Linear: "nn.Identity()",
  };
  const act = activationMap[p.activation] || "nn.Tanh()";

  return `
import torch
import torch.nn as nn
import json

# --- Dataset ---
torch.manual_seed(42)
N = ${p.sample_size}

dataset = "${p.dataset}"
input_dim = ${p.input_count}
output_dim = ${p.output_count}

if dataset == "randn":
    X = torch.randn(N, input_dim)
    Y = torch.randn(N, output_dim)
elif dataset == "circle":
    t = torch.linspace(0, 2 * 3.14159, N)
    X = torch.stack([torch.cos(t), torch.sin(t)], dim=1)
    if input_dim > 2:
        X = torch.cat([X, torch.randn(N, input_dim - 2)], dim=1)
    Y = (X[:, 0:1] ** 2 + X[:, 1:2] ** 2).expand(-1, output_dim)
elif dataset == "xor":
    X = torch.randint(0, 2, (N, input_dim)).float()
    Y = (X[:, 0:1] * X[:, 1:2] if input_dim >= 2 else X[:, 0:1]).expand(-1, output_dim).float()
elif dataset == "gaussian":
    X = torch.randn(N, input_dim)
    Y = torch.exp(-X[:, 0:1] ** 2).expand(-1, output_dim)
elif dataset == "spiral":
    t = torch.linspace(0, 4 * 3.14159, N)
    r = t / (4 * 3.14159)
    X_base = torch.stack([r * torch.cos(t), r * torch.sin(t)], dim=1)
    if input_dim > 2:
        X_base = torch.cat([X_base, torch.randn(N, input_dim - 2)], dim=1)
    X = X_base + torch.randn_like(X_base) * 0.05
    Y = (t / (4 * 3.14159)).unsqueeze(1).expand(-1, output_dim)
else:
    X = torch.randn(N, input_dim)
    Y = torch.randn(N, output_dim)

# --- Model ---
model = nn.Sequential(
    nn.Linear(input_dim, ${p.hidden_count}),
    ${act},
    nn.Linear(${p.hidden_count}, output_dim),
)

criterion = nn.MSELoss()
opt = torch.optim.SGD(model.parameters(), lr=${p.learning_rate})

# --- Train ---
batch_size = ${p.batch_size}
epochs = ${p.epochs}
loss_curve = []

for epoch in range(epochs):
    perm = torch.randperm(N)
    X_shuf = X[perm]
    Y_shuf = Y[perm]
    epoch_loss = 0.0
    n_batches = 0
    for i in range(0, N, batch_size):
        xb = X_shuf[i:i+batch_size]
        yb = Y_shuf[i:i+batch_size]
        pred = model(xb)
        loss = criterion(pred, yb)
        opt.zero_grad()
        loss.backward()
        opt.step()
        epoch_loss += loss.item()
        n_batches += 1
    loss_curve.append(epoch_loss / max(n_batches, 1))

print(json.dumps({"loss_curve": loss_curve, "final_loss": loss_curve[-1]}))
`;
}

function runPython(code: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-u", REPL_SCRIPT], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("Training timed out (60s)"));
    }, 60_000);

    let buffer = "";
    const rl = createInterface({ input: proc.stdout! });

    const onLine = (line: string) => {
      if (line === SENTINEL) {
        rl.removeListener("line", onLine);
        rl.close();
        clearTimeout(timeout);
        proc.kill();
        try {
          resolve(JSON.parse(buffer));
        } catch {
          resolve({ stdout: buffer, stderr: "" });
        }
      } else {
        buffer += (buffer ? "\n" : "") + line;
      }
    };

    rl.on("line", onLine);

    let stderrBuf = "";
    proc.stderr!.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    proc.on("exit", () => {
      clearTimeout(timeout);
      if (!buffer && stderrBuf) {
        resolve({ stdout: "", stderr: stderrBuf });
      }
    });

    const msg = JSON.stringify({ code, setup: "" }) + "\n";
    proc.stdin!.write(msg);
  });
}
