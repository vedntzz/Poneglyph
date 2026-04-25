"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type DocumentStatus = "pending" | "scanning" | "done" | "error";

export type DocumentType = "form" | "transcript";

export interface DocumentCardProps {
  /** Unique identifier for this document. */
  id: string;
  /** Display filename (e.g. "form_english.png"). */
  filename: string;
  /** Document type determines icon. */
  type: DocumentType;
  /** Processing status. */
  status: DocumentStatus;
  /** Number of evidence items extracted (shown when done). */
  evidenceCount: number;
  /** Thumbnail URL for form images (null for transcripts). */
  thumbnailUrl: string | null;
  /** Whether this card is currently selected. */
  isSelected: boolean;
  /** Fires when the card is clicked. */
  onClick: () => void;
}

// ─────────────────────────────────────────────────────────────
// Status pill
// ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-zinc-800 text-zinc-500",
  },
  scanning: {
    label: "Scanning...",
    className: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  done: {
    label: "", // Overridden with evidence count
    className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  },
  error: {
    label: "Error",
    className: "bg-red-500/10 text-red-400 border border-red-500/20",
  },
};

function StatusPill({
  status,
  type,
  evidenceCount,
}: {
  status: DocumentStatus;
  type: DocumentType;
  evidenceCount: number;
}) {
  const config = STATUS_CONFIG[status];
  let label = config.label;
  if (status === "done") {
    if (type === "form") {
      label = `Done — ${evidenceCount} evidence item${evidenceCount !== 1 ? "s" : ""}`;
    } else if (type === "transcript" && evidenceCount > 0) {
      label = `Done — ${evidenceCount} commitment${evidenceCount !== 1 ? "s" : ""}`;
    } else {
      label = "Processed";
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={`${status}-${evidenceCount}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-2xs leading-none",
          config.className,
        )}
      >
        {label}
      </motion.span>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// Type icon
// ─────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: DocumentType }) {
  if (type === "form") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0 text-zinc-500"
      >
        <rect
          x="2"
          y="1"
          width="12"
          height="14"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1" />
        <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1" />
        <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }

  // Transcript icon — speech bubble
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-zinc-500"
    >
      <path
        d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7a1.5 1.5 0 01-1.5 1.5H6l-2.5 2V12H3.5A1.5 1.5 0 012 10.5v-7z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1" />
      <line x1="5" y1="8" x2="9" y2="8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Scan line effect — CSS-only horizontal line on scanning docs
// ─────────────────────────────────────────────────────────────

function ScanLine() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm">
      <div
        className="absolute left-0 right-0 h-px bg-emerald-500/40"
        style={{
          animation: "scan-line 4s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────

/**
 * Document card for the Documents panel.
 *
 * Shows a thumbnail (for forms), filename, type icon, and status pill.
 * The scan line effect runs while the document is being processed.
 */
export function DocumentCard({
  filename,
  type,
  status,
  evidenceCount,
  thumbnailUrl,
  isSelected,
  onClick,
}: DocumentCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg border p-3 text-left",
        "transition-colors duration-150",
        isSelected
          ? "border-zinc-700 bg-zinc-900"
          : "border-zinc-800 bg-card hover:border-zinc-700",
      )}
    >
      {/* Thumbnail or type icon */}
      {thumbnailUrl ? (
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={filename}
            className="h-full w-full object-cover"
          />
          {status === "scanning" && <ScanLine />}
        </div>
      ) : (
        <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-sm bg-zinc-800">
          <TypeIcon type={type} />
        </div>
      )}

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-300 group-hover:text-zinc-100">
          {filename}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <TypeIcon type={type} />
          <span className="text-2xs capitalize text-zinc-600">{type}</span>
        </div>
        <div className="mt-1.5">
          <StatusPill status={status} type={type} evidenceCount={evidenceCount} />
        </div>
      </div>
    </button>
  );
}
