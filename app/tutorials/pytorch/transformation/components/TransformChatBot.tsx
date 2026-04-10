"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/* ── Simple markdown-ish rendering ────────────────────────────────── */

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-accent"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ── Chat component ───────────────────────────────────────────────── */

interface Message {
  role: "user" | "bot";
  text: string;
}

export default function TransformChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: "Hi! Ask me anything about the transforms — your question goes straight to Claude Code.",
    },
  ]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || waiting) return;

    const id = crypto.randomUUID();

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setWaiting(true);

    // Send question to the API route
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, id }),
    });

    // Poll for Claude Code's response
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat?id=${id}`);
        const data = await res.json();
        if (data.ready) {
          clearInterval(poll);
          setMessages((prev) => [...prev, { role: "bot", text: data.answer }]);
          setWaiting(false);
        }
      } catch {
        // keep polling
      }
    }, 1000);

    // Safety timeout — stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(poll);
      setWaiting((w) => {
        if (w) {
          setMessages((prev) => [
            ...prev,
            { role: "bot", text: "Timed out waiting for a response. Make sure Claude Code is running and monitoring." },
          ]);
        }
        return false;
      });
    }, 300_000);
  }, [input, waiting]);

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={open ? "Close help chat" : "Open help chat"}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 flex w-80 flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          style={{ maxHeight: "min(480px, calc(100vh - 120px))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm font-semibold text-foreground">
              Claude Code
            </span>
            <span className="ml-auto flex h-2 w-2 rounded-full bg-green-500" title="Connected" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === "user"
                    ? "ml-8 rounded-lg rounded-br-sm bg-accent/15 px-3 py-2 text-sm text-foreground"
                    : "mr-8 rounded-lg rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground/90 leading-relaxed"
                }
              >
                {msg.role === "bot" ? renderMarkdown(msg.text) : msg.text}
              </div>
            ))}
            {waiting && (
              <div className="mr-8 rounded-lg rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground italic">
                Waiting for Claude Code...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={waiting ? "Waiting..." : "Ask about a parameter..."}
                disabled={waiting}
                className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Type your question"
              />
              <button
                type="submit"
                disabled={!input.trim() || waiting}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
