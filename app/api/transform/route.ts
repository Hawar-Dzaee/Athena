import { NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import path from "path";

const SCRIPT = path.join(process.cwd(), "scripts", "transform.py");

let proc: ChildProcess | null = null;

function getProcess(): ChildProcess {
  if (proc && !proc.killed && proc.exitCode === null) return proc;

  proc = spawn("python3", ["-u", SCRIPT], {
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  proc.on("exit", () => {
    proc = null;
  });

  return proc;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const p = getProcess();
    const result = await sendRequest(p, body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (e) {
    proc?.kill();
    proc = null;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transform failed" },
      { status: 500 },
    );
  }
}

function sendRequest(
  p: ChildProcess,
  body: unknown,
): Promise<{ image?: string; crop_rect?: object | null; error?: string }> {
  return new Promise((resolve, reject) => {
    if (!p.stdout || !p.stdin) return reject(new Error("stdio unavailable"));

    const timeout = setTimeout(() => reject(new Error("Timeout (10s)")), 10_000);

    const rl = createInterface({ input: p.stdout });

    const onLine = (line: string) => {
      rl.removeListener("line", onLine);
      rl.close();
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({ error: line });
      }
    };

    rl.on("line", onLine);
    p.stdin.write(JSON.stringify(body) + "\n");
  });
}
