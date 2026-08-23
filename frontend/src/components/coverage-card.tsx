"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CoverageCardProps {
  /** Indicator ID (e.g. "1.2"). */
  indicatorId: string;
  /** Indicator name. */
  name: string;
  /** Evidence count numerator. */
  evidenceCount: number;
  /** Target string (e.g. "10,000 farmers"). */
  target: string;
  /** Numeric target for fill bar calculation. */
  targetNumber: number;
  /** Verified claim count. */
  verifiedCount: number;
  /** Unsupported claim count. */
  unsupportedCount: number;
  /** Contested claim count. */
  contestedCount: number;
  /** Whether this card is selected. */
  isSelected: boolean;
  /** Click handler. */
  onClick: () => void;
}

// ─────────────────────────────────────────────────────────────
// Fill bar color
// ─────────────────────────────────────────────────────────────

function fillColor(evidenceCount: number, targetNumber: number): string {
  if (evidenceCount === 0) return "bg-zinc-700";
  const ratio = evidenceCount / Math.max(targetNumber, 1);
  if (ratio >= 0.5) return "bg-emerald-500";
  if (ratio >= 0.1) return "bg-amber-500";
  return "bg-red-500";
}

function fillPercent(evidenceCount: number, targetNumber: number): number {
  if (targetNumber === 0) return 0;
  return Math.min((evidenceCount / targetNumber) * 100, 100);
}

// ─────────────────────────────────────────────────────────────
// Animated counter — ticks from previous to current value
// ─────────────────────────────────────────────────────────────

function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (prev === value) return;

    const diff = value - prev;
    const steps = Math.min(Math.abs(diff), 20);
    const stepDuration = 400 / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      setDisplayValue(Math.round(prev + diff * progress));
      if (step >= steps) clearInterval(interval);
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value]);

  return <>{displayValue}</>;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Coverage card for a single logframe indicator.
 *
 * Shows indicator ID, name, evidence-fill bar with animated growth,
 * and a compact verification summary. Clicking filters the right panel.
 */
export function CoverageCard({
  indicatorId,
  name,
  evidenceCount,
  target,
  targetNumber,
  verifiedCount,
  unsupportedCount,
  contestedCount,
  isSelected,
  onClick,
}: CoverageCardProps) {
  const percent = fillPercent(evidenceCount, targetNumber);
  const barColor = fillColor(evidenceCount, targetNumber);
  const hasVerification = verifiedCount + unsupportedCount + contestedCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full rounded-md border px-3 py-2.5 text-left",
        "transition-all duration-200",
        isSelected
          ? "border-zinc-600 bg-zinc-900"
          : "border-zinc-800 hover:border-zinc-700",
      )}
    >
      {/* Top row: indicator ID + verification summary */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs font-medium text-zinc-400">
          {indicatorId}
        </span>
        {hasVerification && (
          <span className="font-mono text-2xs">
            {verifiedCount > 0 && (
              <span className="text-emerald-400">
                {verifiedCount} ✓
              </span>
            )}
            {unsupportedCount > 0 && (
              <span className="ml-1.5 text-red-400">
                {unsupportedCount} ✗
              </span>
            )}
            {contestedCount > 0 && (
              <span className="ml-1.5 text-amber-400">
                {contestedCount} ⚠
              </span>
            )}
          </span>
        )}
      </div>

      {/* Name */}
      <p className="mt-0.5 truncate text-2xs text-zinc-500 group-hover:text-zinc-400">
        {name}
      </p>

      {/* Fill bar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 min-w-0 flex-1 rounded-full bg-zinc-800">
          <motion.div
            className={cn("h-full rounded-full", barColor)}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <span className="shrink-0 font-mono text-2xs text-zinc-500">
          <AnimatedCounter value={evidenceCount} /> / {target}
        </span>
      </div>
    </button>
  );
}
