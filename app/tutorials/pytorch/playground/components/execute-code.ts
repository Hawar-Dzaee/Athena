export async function executeCode(
  code: string,
  sessionId: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const res = await fetch("/api/execute-python", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, sessionId }),
    });
    return await res.json();
  } catch {
    return { stdout: "", stderr: "Failed to connect to execution server." };
  }
}
