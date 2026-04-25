"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  /** Whether to animate audit highlights on mount. */
  animateAudit?: boolean;
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
 * Single claim with audit highlight animation.
 *
 * When animateAudit is true:
 * 1. Amber background flash (250ms) as the "model is judging" feel
 * 2. Tag pill fades in 100ms after the flash settles
 * 3. For unsupported tags, a 2px red left bar fades in and stays
 */
function AuditableClaim({
  claim,
  index,
  isSelected,
  onClaimClick,
  animateAudit,
}: {
  claim: VerifiedClaim;
  index: number;
  isSelected: boolean;
  onClaimClick: (claim: VerifiedClaim) => void;
  animateAudit: boolean;
}) {
  const [showFlash, setShowFlash] = useState(animateAudit);
  const [showTag, setShowTag] = useState(!animateAudit);

  useEffect(() => {
    if (!animateAudit) return;

    // Stagger: each claim starts its flash 200ms after the previous
    const flashDelay = index * 200;
    const flashTimer = setTimeout(() => {
      setShowFlash(true);
      // Flash lasts 250ms, then tag appears
      const tagTimer = setTimeout(() => {
        setShowFlash(false);
        setShowTag(true);
      }, 250);
      return () => clearTimeout(tagTimer);
    }, flashDelay);

    return () => clearTimeout(flashTimer);
  }, [animateAudit, index]);

  const isUnsupported = claim.tag === "unsupported";

  return (
    <span
      className={cn(
        "relative inline rounded-sm px-0.5 transition-colors duration-150",
        isSelected && "bg-zinc-800",
        showFlash && animateAudit && "bg-amber-500/10",
        isUnsupported && showTag && "border-l-2 border-l-red-500 pl-1.5",
      )}
    >
      <span className="text-xs leading-relaxed text-zinc-300">
        {claim.text}
      </span>
      <AnimatePresence>
        {showTag && (
          <motion.span
            initial={animateAudit ? { opacity: 0 } : { opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          >
            <TagPill tag={claim.tag} onClick={() => onClaimClick(claim)} />
          </motion.span>
        )}
      </AnimatePresence>
      {" "}
    </span>
  );
}

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
  animateAudit = false,
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
        {claims.map((claim, index) => (
          <AuditableClaim
            key={claim.id}
            claim={claim}
            index={index}
            isSelected={claim.id === selectedClaimId}
            onClaimClick={onClaimClick}
            animateAudit={animateAudit}
          />
        ))}
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
