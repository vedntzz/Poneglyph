"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type AgentStatus = "pending" | "starting" | "running" | "done" | "error";

interface AgentCardProps {
  label: string;
  status: AgentStatus;
  tokensUsed: number;
  budgetTotal: number;
  currentAction: string;
  resultSummary: string;
}

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  pending: {
    label: "Idle",
    dotClass: "bg-zinc-600",
    textClass: "text-zinc-500",
  },
  starting: {
    label: "Starting",
    dotClass: "bg-zinc-400",
    textClass: "text-zinc-400",
  },
  running: {
    label: "Running",
    dotClass: "bg-amber-500",
    textClass: "text-amber-500",
  },
  done: {
    label: "Done",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-500",
  },
  error: {
    label: "Error",
    dotClass: "bg-red-500",
    textClass: "text-red-500",
  },
};

function StatusDot({ status }: { status: AgentStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn("inline-block h-1.5 w-1.5 rounded-full", config.dotClass)}
      />
      <span className={cn("text-2xs font-medium uppercase tracking-wider", config.textClass)}>
        {config.label}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Token bar
// ─────────────────────────────────────────────────────────────

function TokenBar({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  if (total === 0) return null;

  const percent = Math.min((used / total) * 100, 100);
  const isOver = used > total;

  let barColor = "bg-emerald-500";
  if (isOver || percent > 75) barColor = "bg-red-500";
  else if (percent > 50) barColor = "bg-amber-500";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xs text-zinc-400">
          {used.toLocaleString()} / {total.toLocaleString()}
        </span>
        {isOver ? (
          <span className="font-mono text-2xs text-amber-500">over budget</span>
        ) : (
          <span className="font-mono text-2xs text-zinc-600">
            {Math.round(percent)}%
          </span>
        )}
      </div>
      <div className="h-1 w-full rounded-full bg-zinc-800">
        <motion.div
          className={cn("h-full rounded-full", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percent, 100)}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────

/** Agent card with state-driven border and live token accounting. */
export function AgentCard({
  label,
  status,
  tokensUsed,
  budgetTotal,
  currentAction,
  resultSummary,
}: AgentCardProps) {
  const isOver = budgetTotal > 0 && tokensUsed > budgetTotal;

  const borderClass =
    status === "running"
      ? "border-zinc-700 animate-border-pulse"
      : status === "done" && !isOver
        ? "border-emerald-600/50"
        : status === "done" && isOver
          ? "border-amber-600/50"
          : status === "error"
            ? "border-red-600/50"
            : "border-zinc-800";

  return (
    <motion.div
      layout
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors duration-300",
        borderClass,
      )}
    >
      {/* Header row: name + status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-100">{label}</span>
        <StatusDot status={status} />
      </div>

      {/* Current action */}
      <div className="mt-2 min-h-[1.125rem]">
        {currentAction && (
          <p className="truncate text-2xs text-zinc-500">{currentAction}</p>
        )}
      </div>

      {/* Token bar */}
      <div className="mt-3">
        <TokenBar used={tokensUsed} total={budgetTotal} />
      </div>

      {/* Result summary */}
      {resultSummary && (
        <p className="mt-3 text-xs font-medium text-zinc-300">
          {resultSummary}
        </p>
      )}
    </motion.div>
  );
}
