import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CHAT_DIR = path.join(process.cwd(), ".chat");
const QUESTION_FILE = path.join(CHAT_DIR, "question.json");
const RESPONSE_FILE = path.join(CHAT_DIR, "response.json");

function ensureDir() {
  if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR, { recursive: true });
}

// POST — user sends a question from the browser
export async function POST(req: NextRequest) {
  const { question, id } = await req.json();
  ensureDir();

  fs.writeFileSync(
    QUESTION_FILE,
    JSON.stringify({ id, question, timestamp: Date.now() }, null, 2),
  );

  // Clear any stale response
  if (fs.existsSync(RESPONSE_FILE)) fs.unlinkSync(RESPONSE_FILE);

  return NextResponse.json({ ok: true, id });
}

// GET — browser polls for Claude Code's response
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!fs.existsSync(RESPONSE_FILE)) {
    return NextResponse.json({ ready: false });
  }

  const data = JSON.parse(fs.readFileSync(RESPONSE_FILE, "utf-8"));

  // Only return if it matches the requested question id
  if (data.id !== id) {
    return NextResponse.json({ ready: false });
  }

  return NextResponse.json({ ready: true, answer: data.answer });
}
