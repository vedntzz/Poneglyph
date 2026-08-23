"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface BriefingItemData {
  text: string;
  citations: string[];
  rationale: string;
}

interface BriefingData {
  project_id: string;
  stakeholder: string;
  meeting_context: string | null;
  project_summary: string;
  push_for: BriefingItemData[];
  push_back_on_us: BriefingItemData[];
  do_not_bring_up: BriefingItemData[];
  closing_note: string;
}

type PageState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "display"; briefing: BriefingData }
  | { kind: "error"; message: string };

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const STAKEHOLDER_OPTIONS = [
  "World Bank",
  "State Government",
  "Donor Field Mission",
] as const;

/** Rotating status messages — specific to what the agent actually does. */
const LOADING_MESSAGES = [
  "Reading project memory\u2026",
  "Checking 19 commitments across 2 meetings\u2026",
  "Cross-referencing 18 evidence items with logframe targets\u2026",
  "Looking for commitment drift\u2026",
  "Drafting briefing for World Bank\u2026",
  "Verifying citations\u2026",
] as const;

/** Cycle interval for rotating loading messages (ms). */
const LOADING_ROTATION_MS = 3_500;

/** Static recent activity — from demo project's timeline. */
const RECENT_ACTIVITY = [
  {
    timestamp: "2h ago",
    action: "PHM training attendance ingested",
    detail: "47 women logged in Gumla pilot session",
  },
  {
    timestamp: "1d ago",
    action: "Q1 review meeting processed",
    detail: "13 commitments tracked, 4 open questions flagged",
  },
  {
    timestamp: "3d ago",
    action: "AgriMart drift flagged",
    detail: "50 \u2192 42 silent walk-back detected across meetings",
  },
] as const;

// Demo project ID — matches the pre-loaded project in the backend.
// HACKATHON COMPROMISE: single project, no project selector.
// See FAILURE_MODES.md.
const DEMO_PROJECT_ID = "mp-fpc-2024";

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const [pageState, setPageState] = useState<PageState>({ kind: "idle" });
  const [stakeholder, setStakeholder] = useState<string>(
    STAKEHOLDER_OPTIONS[0]
  );
  const [meetingContext, setMeetingContext] = useState("");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Rotate loading messages every LOADING_ROTATION_MS
  useEffect(() => {
    if (pageState.kind !== "loading") return;
    setLoadingMessageIndex(0);
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, LOADING_ROTATION_MS);
    return () => clearInterval(interval);
  }, [pageState.kind]);

  const handleGenerate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPageState({ kind: "loading" });

    try {
      const res = await fetch(`${BACKEND_URL}/api/briefing/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: DEMO_PROJECT_ID,
          stakeholder,
          meeting_context: meetingContext.trim() || null,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          detail?.detail || `Backend returned ${res.status}`
        );
      }

      const data: BriefingData = await res.json();
      setPageState({ kind: "display", briefing: data });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPageState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Failed to generate briefing",
      });
    }
  }, [stakeholder, meetingContext]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setPageState({ kind: "idle" });
    setMeetingContext("");
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12 md:py-20">
      <div className="w-full max-w-[720px] space-y-10">
        {/* ── Project context strip ────────────────────────── */}
        <ProjectContextStrip />

        {/* ── Main content area ────────────────────────────── */}
        <AnimatePresence mode="wait">
          {pageState.kind === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <HeroCard
                stakeholder={stakeholder}
                onStakeholderChange={setStakeholder}
                meetingContext={meetingContext}
                onMeetingContextChange={setMeetingContext}
                onGenerate={handleGenerate}
              />
            </motion.div>
          )}

          {pageState.kind === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <LoadingState
                messageIndex={loadingMessageIndex}
                onCancel={handleReset}
              />
            </motion.div>
          )}

          {pageState.kind === "display" && (
            <motion.div
              key="display"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <BriefingDisplay
                briefing={pageState.briefing}
                onReset={handleReset}
              />
            </motion.div>
          )}

          {pageState.kind === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ErrorState
                message={pageState.message}
                onRetry={handleGenerate}
                onReset={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Recent activity ──────────────────────────────── */}
        <RecentActivityStrip />

        {/* ── Footer link ─────────────────────────────────── */}
        <footer className="text-center pt-4 pb-8">
          <Link
            href="/demo"
            className="text-2xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open project dashboard &rarr;
          </Link>
        </footer>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Project context strip
// ─────────────────────────────────────────────────────────────

function ProjectContextStrip() {
  return (
    <div className="flex items-center gap-2 text-2xs text-muted-foreground">
      <span className="font-medium text-foreground/70">
        Madhya Pradesh Farmer Producer Company
      </span>
      <span className="text-border">&middot;</span>
      <span>World Bank</span>
      <span className="text-border">&middot;</span>
      <span>Last updated 2h ago</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero card
// ─────────────────────────────────────────────────────────────

interface HeroCardProps {
  stakeholder: string;
  onStakeholderChange: (value: string) => void;
  meetingContext: string;
  onMeetingContextChange: (value: string) => void;
  onGenerate: () => void;
}

function HeroCard({
  stakeholder,
  onStakeholderChange,
  meetingContext,
  onMeetingContextChange,
  onGenerate,
}: HeroCardProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-foreground">
        What do you want to do today?
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ── Primary: Briefing ────────────────────────── */}
        <div className="rounded-lg border bg-card p-6 space-y-5">
          <div className="space-y-2">
            {/* Icon: simplified briefcase/document */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-emerald-500"
            >
              <path
                d="M3 6h14v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6ZM7 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 10v3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <h2 className="text-sm font-medium text-foreground">
              Brief me for the next stakeholder meeting
            </h2>
            <p className="text-2xs text-muted-foreground leading-relaxed">
              Get a 1-page brief on what to push for, what they&apos;ll push
              back on, and what to avoid raising
            </p>
          </div>

          {/* Stakeholder selector */}
          <div className="space-y-3">
            <label className="block text-2xs text-muted-foreground">
              Stakeholder
            </label>
            <select
              value={stakeholder}
              onChange={(e) => onStakeholderChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-2xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STAKEHOLDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <label className="block text-2xs text-muted-foreground">
              Meeting context{" "}
              <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <Input
              placeholder="e.g. Quarterly progress review — Q1 FY2026"
              value={meetingContext}
              onChange={(e) => onMeetingContextChange(e.target.value)}
              className="text-2xs h-9"
            />
          </div>

          <Button
            onClick={onGenerate}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-2xs h-9"
          >
            Generate briefing
          </Button>
        </div>

        {/* ── Secondary: Drift ─────────────────────────── */}
        <div className="rounded-lg border bg-card p-6 flex flex-col justify-between">
          <div className="space-y-2">
            {/* Icon: diverging arrows */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-amber-500"
            >
              <path
                d="M10 4v6M10 10l-4 4M10 10l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 className="text-sm font-medium text-foreground">
              Show me what&apos;s drifting
            </h2>
            <p className="text-2xs text-muted-foreground leading-relaxed">
              See where commitments have silently changed across stakeholder
              meetings
            </p>
          </div>

          <Link href="/demo" className="mt-6">
            <Button
              variant="outline"
              className="w-full text-2xs h-9"
            >
              View drift timeline
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Loading state
// ─────────────────────────────────────────────────────────────

interface LoadingStateProps {
  messageIndex: number;
  onCancel: () => void;
}

function LoadingState({ messageIndex, onCancel }: LoadingStateProps) {
  return (
    <div className="rounded-lg border bg-card p-12 flex flex-col items-center gap-6">
      {/* Pulsing dot */}
      <div className="relative h-5 w-5">
        <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
        <span className="absolute inset-1 rounded-full bg-emerald-500" />
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={messageIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-muted-foreground"
        >
          {LOADING_MESSAGES[messageIndex]}
        </motion.p>
      </AnimatePresence>

      <p className="text-2xs text-muted-foreground/50">
        This takes 30&ndash;60 seconds
      </p>

      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="text-2xs text-muted-foreground"
      >
        Cancel
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Briefing display
// ─────────────────────────────────────────────────────────────

interface BriefingDisplayProps {
  briefing: BriefingData;
  onReset: () => void;
}

function BriefingDisplay({ briefing, onReset }: BriefingDisplayProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-foreground">
          Briefing: {briefing.stakeholder}
        </h2>
        {briefing.meeting_context && (
          <p className="text-2xs text-muted-foreground">
            {briefing.meeting_context}
          </p>
        )}
      </div>

      {/* Project summary — prose-style, wider line-height for readability */}
      <p className="text-sm text-foreground/80 max-w-[65ch]" style={{ lineHeight: 1.7 }}>
        {briefing.project_summary}
      </p>

      {/* ── Push for ──────────────────────────────────── */}
      <BriefingSection
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        title="Push for"
        accentClass="text-emerald-500"
        borderClass="border-emerald-500/20"
        items={briefing.push_for}
      />

      {/* ── They'll push back ─────────────────────────── */}
      <BriefingSection
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M13 8H3M7 4L3 8l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        title="They'll push back on"
        accentClass="text-amber-500"
        borderClass="border-amber-500/20"
        items={briefing.push_back_on_us}
      />

      {/* ── Don't bring up ────────────────────────────── */}
      <BriefingSection
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        title="Don't bring up"
        accentClass="text-muted-foreground"
        borderClass="border-border"
        items={briefing.do_not_bring_up}
      />

      {/* ── Closing note ──────────────────────────────── */}
      <div className="border-t border-zinc-800 pt-6 pl-4">
        <p className="text-2xs text-zinc-400 italic" style={{ lineHeight: 1.6 }}>
          {briefing.closing_note}
        </p>
      </div>

      {/* ── Actions ───────────────────────────────────── */}
      <div className="flex gap-3">
        <Button
          onClick={onReset}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-2xs h-9"
        >
          Generate another briefing
        </Button>
        <Button
          variant="outline"
          className="text-2xs h-9"
          onClick={() => {
            // Stub — PDF export is out of scope for the hackathon.
            // A real product would render the briefing to a PDF via
            // a headless browser or a server-side PDF library.
            alert("PDF export coming soon");
          }}
        >
          Export as PDF
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Briefing section (push_for / push_back / do_not_bring_up)
// ─────────────────────────────────────────────────────────────

interface BriefingSectionProps {
  icon: React.ReactNode;
  title: string;
  accentClass: string;
  borderClass: string;
  items: BriefingItemData[];
}

function BriefingSection({
  icon,
  title,
  accentClass,
  borderClass,
  items,
}: BriefingSectionProps) {
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 ${accentClass}`}>
        {icon}
        <h3 className="text-xs font-medium">{title}</h3>
      </div>

      <div className="space-y-4">
        {items.map((item, i) => (
          <div
            key={i}
            className={`rounded-md border ${borderClass} bg-card p-5 space-y-3`}
          >
            <p className="text-sm font-medium text-foreground" style={{ lineHeight: 1.6 }}>
              {item.text}
            </p>
            <p className="text-2xs text-zinc-400 italic" style={{ lineHeight: 1.6 }}>
              {item.rationale}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {item.citations.map((cid) => (
                <Badge
                  key={cid}
                  variant="outline"
                  className="font-mono text-[10px] px-1.5 py-0 h-5 text-zinc-500 border-zinc-700 cursor-default"
                >
                  {cid}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}

function ErrorState({ message, onRetry, onReset }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-card p-8 space-y-4">
      <p className="text-sm text-destructive font-medium">
        Briefing generation failed
      </p>
      <p className="text-2xs text-muted-foreground">{message}</p>
      <div className="flex gap-3">
        <Button
          onClick={onRetry}
          className="text-2xs h-9"
          size="sm"
        >
          Retry
        </Button>
        <Button
          variant="ghost"
          onClick={onReset}
          className="text-2xs h-9"
          size="sm"
        >
          Back
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Recent activity strip
// ─────────────────────────────────────────────────────────────

function RecentActivityStrip() {
  return (
    <div className="space-y-3">
      <h3 className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">
        Recent activity
      </h3>
      <div className="space-y-0 divide-y divide-border">
        {RECENT_ACTIVITY.map((entry, i) => (
          <div key={i} className="flex items-baseline gap-3 py-2.5">
            <span className="text-2xs text-muted-foreground/50 font-mono w-12 shrink-0">
              {entry.timestamp}
            </span>
            <span className="text-2xs text-foreground/70">
              {entry.action}
            </span>
            <span className="text-2xs text-muted-foreground hidden sm:inline">
              &middot; {entry.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
