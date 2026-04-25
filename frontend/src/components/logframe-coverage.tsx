"use client";

import { CoverageCard } from "./coverage-card";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface IndicatorData {
  id: string;
  name: string;
  target: string;
  targetNumber: number;
}

export interface OutputGroup {
  id: string;
  name: string;
  indicators: IndicatorData[];
}

interface LogframeCoverageProps {
  outputs: OutputGroup[];
  /** Evidence counts keyed by indicator id (e.g. "Output 1.2" → 5). */
  evidenceCounts: Record<string, number>;
  /** Verification counts keyed by indicator id → { verified, unsupported, contested }. */
  verificationCounts: Record<
    string,
    { verified: number; unsupported: number; contested: number }
  >;
  /** Currently selected indicator ID. */
  selectedIndicatorId: string | null;
  /** Fires when an indicator card is clicked. */
  onIndicatorClick: (indicatorId: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Logframe Coverage panel — replaces the old Project Binder tree.
 *
 * Each logframe output is a section header. Each indicator within
 * is a CoverageCard with an evidence-fill bar and verification summary.
 */
export function LogframeCoverage({
  outputs,
  evidenceCounts,
  verificationCounts,
  selectedIndicatorId,
  onIndicatorClick,
}: LogframeCoverageProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Logframe Coverage
        </h2>
        <p className="mt-0.5 font-mono text-2xs text-zinc-600">mp-fpc-2024</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {outputs.map((output) => (
          <div key={output.id}>
            <p className="mb-1 px-1 text-2xs font-medium uppercase tracking-wider text-zinc-600">
              {output.id}
            </p>
            <p className="mb-2 px-1 text-2xs text-zinc-600">{output.name}</p>

            <div className="space-y-1.5">
              {output.indicators.map((ind) => {
                const key = `Output ${ind.id}`;
                const count = evidenceCounts[key] ?? 0;
                const verification = verificationCounts[key] ?? {
                  verified: 0,
                  unsupported: 0,
                  contested: 0,
                };

                return (
                  <CoverageCard
                    key={ind.id}
                    indicatorId={ind.id}
                    name={ind.name}
                    evidenceCount={count}
                    target={ind.target}
                    targetNumber={ind.targetNumber}
                    verifiedCount={verification.verified}
                    unsupportedCount={verification.unsupported}
                    contestedCount={verification.contested}
                    isSelected={selectedIndicatorId === key}
                    onClick={() => onIndicatorClick(key)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
