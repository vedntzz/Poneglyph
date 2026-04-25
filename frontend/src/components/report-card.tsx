"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  VerifiedReportViewer,
  type VerifiedClaim,
} from "./verified-report-viewer";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ReportCardProps {
  sectionName: string;
  claims: VerifiedClaim[];
  onClaimClick: (claim: VerifiedClaim) => void;
  selectedClaimId: string | null;
  /** Whether to animate counters from zero (completion choreography). */
  animateCounters: boolean;
}

type RiskLevel = "low" | "medium" | "high";

// ─────────────────────────────────────────────────────────────
// Risk calculation
// ─────────────────────────────────────────────────────────────

function calculateRisk(claims: VerifiedClaim[]): RiskLevel {
  const unsupported = claims.filter((c) => c.tag === "unsupported").length;
  const contested = claims.filter((c) => c.tag === "contested").length;
  if (unsupported > 1 || contested > 0) return "high";
  if (unsupported > 0) return "medium";
  return "low";
}

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; className: string }
> = {
  low: {
    label: "Low Risk",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  medium: {
    label: "Medium Risk",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  high: {
    label: "High Risk",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

// ─────────────────────────────────────────────────────────────
// Animated counter — ticks from 0 to target over duration
// ─────────────────────────────────────────────────────────────

function TickUpCounter({
  target,
  animate,
  durationMs = 800,
}: {
  target: number;
  animate: boolean;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(animate ? 0 : target);
  const prevAnimateRef = useRef(animate);

  useEffect(() => {
    // Only trigger tick-up when animate transitions to true
    if (animate && !prevAnimateRef.current) {
      setDisplay(0);
      const steps = Math.max(target, 1);
      const stepTime = durationMs / steps;
      let current = 0;

      const interval = setInterval(() => {
        current++;
        setDisplay(current);
        if (current >= target) clearInterval(interval);
      }, stepTime);

      prevAnimateRef.current = animate;
      return () => clearInterval(interval);
    }

    // If not animating, just set directly
    if (!animate) {
      setDisplay(target);
    }

    prevAnimateRef.current = animate;
  }, [animate, target, durationMs]);

  // Also sync when target changes without animation
  useEffect(() => {
    if (!prevAnimateRef.current) {
      setDisplay(target);
    }
  }, [target]);

  return <>{display}</>;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Report card with collapsible summary header.
 *
 * Header shows: title, date, format badge, 3 large verification
 * counters (verified/unsupported/contested), and a risk badge.
 * Clicking the header expands the full prose report inline.
 * "Open flagged claims" filters to only unsupported/contested.
 */
export function ReportCard({
  sectionName,
  claims,
  onClaimClick,
  selectedClaimId,
  animateCounters,
}: ReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  // Animate audit highlights on first expand only
  const [hasExpandedOnce, setHasExpandedOnce] = useState(false);

  const verifiedCount = claims.filter((c) => c.tag === "verified").length;
  const unsupportedCount = claims.filter((c) => c.tag === "unsupported").length;
  const contestedCount = claims.filter((c) => c.tag === "contested").length;
  const risk = calculateRisk(claims);
  const riskConfig = RISK_CONFIG[risk];

  const displayClaims = showFlaggedOnly
    ? claims.filter((c) => c.tag === "unsupported" || c.tag === "contested")
    : claims;

  const hasFlagged = unsupportedCount + contestedCount > 0;

  return (
    <div className="rounded-lg border border-zinc-800">
      {/* Header — always visible, clickable to expand */}
      <button
        onClick={() => {
          if (!isExpanded && !hasExpandedOnce) setHasExpandedOnce(true);
          setIsExpanded(!isExpanded);
        }}
        className="w-full px-5 py-4 text-left transition-colors hover:bg-zinc-900/50"
      >
        {/* Title row */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">
              {sectionName || "World Bank Q2 ISR Draft"}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-2xs text-zinc-600">
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 font-mono text-2xs text-zinc-400">
                World Bank ISR
              </span>
            </div>
          </div>
          {/* Risk badge */}
          <span
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-2xs",
              riskConfig.className,
            )}
          >
            {riskConfig.label}
          </span>
        </div>

        {/* Verification counters — large monospace numbers */}
        <div className="mt-4 flex items-baseline gap-6">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg text-emerald-400">
              <TickUpCounter
                target={verifiedCount}
                animate={animateCounters}
              />
            </span>
            <span className="text-2xs text-emerald-400/60">✓ verified</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg text-red-400">
              <TickUpCounter
                target={unsupportedCount}
                animate={animateCounters}
              />
            </span>
            <span className="text-2xs text-red-400/60">✗ unsupported</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg text-amber-400">
              <TickUpCounter
                target={contestedCount}
                animate={animateCounters}
              />
            </span>
            <span className="text-2xs text-amber-400/60">⚠ contested</span>
          </div>
        </div>

        {/* Expand hint */}
        <div className="mt-3 flex items-center gap-1 text-2xs text-zinc-600">
          <span>{isExpanded ? "▾" : "▸"}</span>
          <span>
            {isExpanded ? "Collapse report" : "Click to expand full report"}
          </span>
        </div>
      </button>

      {/* Expanded body — full prose report */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-800 px-5 py-4">
              {/* Flagged filter toggle */}
              {hasFlagged && (
                <div className="mb-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFlaggedOnly(!showFlaggedOnly);
                    }}
                    className={cn(
                      "rounded-md border px-3 py-1.5 font-mono text-2xs transition-colors",
                      showFlaggedOnly
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-600",
                    )}
                  >
                    {showFlaggedOnly
                      ? `Showing ${unsupportedCount + contestedCount} flagged claims`
                      : "Open flagged claims"}
                  </button>
                </div>
              )}

              <VerifiedReportViewer
                sectionName={showFlaggedOnly ? "Flagged Claims" : sectionName}
                claims={displayClaims}
                onClaimClick={onClaimClick}
                selectedClaimId={selectedClaimId}
                animateAudit={hasExpandedOnce && isExpanded}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
