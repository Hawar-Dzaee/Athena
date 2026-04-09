import { NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { createInterface } from "readline";

const SENTINEL = "---ATHENA_REPL_DONE---";
const REPL_SCRIPT = path.join(process.cwd(), "scripts", "repl.py");

// Module-level persistent process per session ID
const sessions = new Map<string, ChildProcess>();

function getOrCreateSession(sessionId: string): ChildProcess {
  let proc = sessions.get(sessionId);
  if (proc && !proc.killed && proc.exitCode === null) {
    return proc;
  }

  proc = spawn("python3", ["-u", REPL_SCRIPT], {
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  proc.on("exit", () => {
    sessions.delete(sessionId);
  });

  sessions.set(sessionId, proc);
  return proc;
}

export async function POST(req: NextRequest) {
  const { code, setup, sessionId = "default" } = (await req.json()) as {
    code: string;
    setup?: string;
    sessionId?: string;
  };

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    const proc = getOrCreateSession(sessionId);
    const result = await sendToRepl(proc, code, setup);
    return NextResponse.json(result);
  } catch {
    // If the process died, clean it up so next request starts fresh
    sessions.delete(sessionId);
    return NextResponse.json(
      { stdout: "", stderr: "Python process crashed. Try running again." },
      { status: 500 },
    );
  }
}

// Reset endpoint — kills the session so a fresh one starts
export async function DELETE(req: NextRequest) {
  const { sessionId = "default" } = (await req.json()) as {
    sessionId?: string;
  };
  const proc = sessions.get(sessionId);
  if (proc) {
    proc.kill();
    sessions.delete(sessionId);
  }
  return NextResponse.json({ ok: true });
}

function sendToRepl(
  proc: ChildProcess,
  code: string,
  setup?: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (!proc.stdout || !proc.stdin) {
      return reject(new Error("Process stdio not available"));
    }

    const timeout = setTimeout(() => {
      reject(new Error("Execution timed out (30s)"));
    }, 30_000);

    let buffer = "";
    const rl = createInterface({ input: proc.stdout });

    const onLine = (line: string) => {
      if (line === SENTINEL) {
        rl.removeListener("line", onLine);
        rl.close();
        clearTimeout(timeout);
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

    const msg = JSON.stringify({ code, setup: setup || "" }) + "\n";
    proc.stdin.write(msg);
  });
}
