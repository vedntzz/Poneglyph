"use client";

import { useEffect, useState, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface StreamingTextProps {
  /** Full text to reveal word-by-word. */
  text: string;
  /** Milliseconds per word. Default 30ms. */
  msPerWord?: number;
  /** CSS classes for the text. */
  className?: string;
  /** Fires when the full text has been revealed. */
  onComplete?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Streaming text reveal — simulates "the model is writing."
 *
 * Words appear one at a time at the specified rate. When the text
 * prop changes (new sentence), the reveal restarts from the beginning.
 * Used in the draft report view as Drafter SSE events stream in.
 */
export function StreamingText({
  text,
  msPerWord = 30,
  className,
  onComplete,
}: StreamingTextProps) {
  const words = text.split(/\s+/);
  const [visibleCount, setVisibleCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setVisibleCount(0);

    if (words.length === 0) return;

    let count = 0;
    const interval = setInterval(() => {
      count++;
      setVisibleCount(count);
      if (count >= words.length) {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, msPerWord);

    return () => clearInterval(interval);
  }, [text, msPerWord, words.length]);

  return (
    <span className={className}>
      {words.slice(0, visibleCount).join(" ")}
      {visibleCount < words.length && (
        <span className="inline-block h-3.5 w-0.5 animate-pulse bg-zinc-500 align-middle" />
      )}
    </span>
  );
}
