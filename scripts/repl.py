"""
Persistent Python REPL for Athena's PyTorch playground.

Reads JSON lines from stdin: {"code": "...", "setup": "..."}
Executes in a shared namespace so imports/variables persist across cells.
Writes JSON lines to stdout delimited by a sentinel.
"""

import ast
import io
import json
import sys
import traceback
import contextlib

SENTINEL = "---ATHENA_REPL_DONE---"
namespace: dict = {"__builtins__": __builtins__}


def execute(code: str) -> dict:
    """Execute code Jupyter-style: run all statements, then eval+display the last
    expression if it isn't an assignment / statement."""
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    try:
        tree = ast.parse(code, "<cell>")
    except SyntaxError:
        stderr_buf.write(traceback.format_exc())
        return {"stdout": "", "stderr": stderr_buf.getvalue()}

    # If the last node is an expression (not assignment, import, etc.),
    # split it off so we can eval it and display the result.
    last_expr = None
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        last_expr = ast.Expression(body=tree.body.pop().value)
        ast.fix_missing_locations(last_expr)

    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            # Execute everything except the last expression
            if tree.body:
                exec(compile(tree, "<cell>", "exec"), namespace)
            # Eval the last expression and display if non-None
            if last_expr is not None:
                result = eval(compile(last_expr, "<cell>", "eval"), namespace)
                if result is not None:
                    print(repr(result))
    except Exception:
        stderr_buf.write(traceback.format_exc())

    return {
        "stdout": stdout_buf.getvalue(),
        "stderr": stderr_buf.getvalue(),
    }


def main():
    # Unbuffered output
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, line_buffering=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        # Optional setup code (e.g. "import torch") — runs silently
        setup = msg.get("setup", "")
        if setup:
            execute(setup)

        code = msg.get("code", "")
        result = execute(code) if code else {"stdout": "", "stderr": ""}

        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.write(SENTINEL + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
