"use client";

import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type VerificationTag = "verified" | "contested" | "unsupported";

export interface VerifiedClaim {
  id: string;
  text: string;
  tag: VerificationTag;
  reason: string;
  citationIds: string[];
  sourceType: string;
  usedVision: boolean;
}

interface VerifiedReportViewerProps {
  sectionName: string;
  claims: VerifiedClaim[];
  /** Fires when a tag pill is clicked — opens evidence view. */
  onClaimClick: (claim: VerifiedClaim) => void;
  /** Currently selected claim (highlighted background). */
  selectedClaimId: string | null;
}

// ─────────────────────────────────────────────────────────────
// Tag pill
// ─────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<
  VerificationTag,
  { icon: string; bgClass: string; textClass: string; borderClass: string }
> = {
  verified: {
    icon: "\u2713",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/20",
  },
  contested: {
    icon: "\u26A0",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-400",
    borderClass: "border-amber-500/20",
  },
  unsupported: {
    icon: "\u2717",
    bgClass: "bg-red-500/10",
    textClass: "text-red-400",
    borderClass: "border-red-500/20",
  },
};

function TagPill({
  tag,
  onClick,
}: {
  tag: VerificationTag;
  onClick: () => void;
}) {
  const config = TAG_CONFIG[tag];
  return (
    <button
      onClick={onClick}
      className={cn(
        "ml-1.5 inline-flex items-center gap-0.5 rounded-sm border px-1 py-0.5",
        "font-mono text-2xs leading-none",
        "cursor-pointer transition-opacity hover:opacity-80",
        config.bgClass,
        config.textClass,
        config.borderClass,
      )}
    >
      <span>{config.icon}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Renders a verified report section with inline ✓/⚠/✗ tag pills.
 *
 * Each claim is a sentence followed by a clickable tag. Clicking
 * the tag fires onClaimClick, which the parent uses to show the
 * evidence view in the right panel.
 *
 * Reading width capped at 65ch for comfortable reading.
 */
export function VerifiedReportViewer({
  sectionName,
  claims,
  onClaimClick,
  selectedClaimId,
}: VerifiedReportViewerProps) {
  if (claims.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-2xs text-zinc-600">
          Report appears here after Auditor verifies
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[65ch] space-y-4">
      <h3 className="text-sm font-medium text-zinc-100">{sectionName}</h3>

      <div className="space-y-2">
        {claims.map((claim) => {
          const isSelected = claim.id === selectedClaimId;

          return (
            <span
              key={claim.id}
              className={cn(
                "inline rounded-sm px-0.5 transition-colors duration-150",
                isSelected && "bg-zinc-800",
              )}
            >
              <span className="text-xs leading-relaxed text-zinc-300">
                {claim.text}
              </span>
              <TagPill
                tag={claim.tag}
                onClick={() => onClaimClick(claim)}
              />
              {" "}
            </span>
          );
        })}
      </div>

      {/* Summary counts */}
      <div className="flex gap-4 border-t border-zinc-800 pt-3">
        {(["verified", "contested", "unsupported"] as const).map((tag) => {
          const count = claims.filter((c) => c.tag === tag).length;
          const config = TAG_CONFIG[tag];
          return (
            <span
              key={tag}
              className={cn("font-mono text-2xs", config.textClass)}
            >
              {config.icon} {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
