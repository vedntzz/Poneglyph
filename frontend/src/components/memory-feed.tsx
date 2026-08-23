"use client";

import { useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface MemoryEvent {
  id: string;
  timestamp: number;
  agent: string;
  filePath: string;
  summary: string;
}

interface MemoryFeedProps {
  events: MemoryEvent[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const AGENT_COLORS: Record<string, string> = {
  scout: "text-emerald-500",
  scribe: "text-emerald-500",
  archivist: "text-zinc-300",
  drafter: "text-zinc-300",
  auditor: "text-amber-500",
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/** Scrollable memory write feed — newest on top, auto-scrolls. */
export function MemoryFeed({ events }: MemoryFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new event (newest-first ordering)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-2xs text-zinc-600">
          Memory writes appear here during a run
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col gap-0.5 overflow-y-auto"
    >
      <AnimatePresence initial={false}>
        {events.map((evt) => (
          <motion.div
            key={evt.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex gap-3 rounded-sm px-2 py-1.5 hover:bg-zinc-900/50"
          >
            <span className="shrink-0 font-mono text-2xs text-zinc-600">
              {formatTime(evt.timestamp)}
            </span>
            <span
              className={`shrink-0 font-mono text-2xs ${AGENT_COLORS[evt.agent] ?? "text-zinc-400"}`}
            >
              {evt.agent}
            </span>
            <span className="min-w-0 flex-1 truncate text-2xs text-zinc-400">
              <span className="font-mono text-zinc-600">{evt.filePath}</span>
              {" "}
              {evt.summary}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
