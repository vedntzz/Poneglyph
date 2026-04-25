"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { AppNav } from "@/components/app-nav";
import { CommandPalette } from "@/components/command-palette";
import { InfoPopover } from "@/components/info-popover";

/**
 * Lazy-load the Engine dashboard (the /demo page content).
 * Only fetched when the user expands the Engine section — keeps
 * initial bundle small and avoids loading SSE infrastructure upfront.
 */
const EngineDashboard = dynamic(() => import("../demo/page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <p className="text-2xs text-text-tertiary">Loading engine...</p>
    </div>
  ),
});

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

type BriefingState =
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

const LOADING_ROTATION_MS = 3_500;

// HACKATHON COMPROMISE: single project, no project selector.
// See FAILURE_MODES.md.
const DEMO_PROJECT_ID = "mp-fpc-2024";

// ── Tooltip content for "?" popovers (spec from session 012) ──

const TOOLTIPS = {
  heroStat:
    "Project verification rate. Of the 16 claims drafted in the latest report, 14 were verified by independent re-reading of source documents. The Auditor agent caught 1 contested claim (evidence partially supports) and 1 unsupported claim (no evidence found). Drift flags surface separately.",
  briefings:
    'On-demand pre-meeting briefings. The Briefing agent reads project memory, cross-references commitments with evidence, and drafts what to push for, what stakeholders will push back on, and what not to bring up. Every claim cites a specific evidence ID, commitment ID, or meeting ID.',
  drift:
    "Silent walk-backs detected by the Archivist agent. When a commitment from one meeting (e.g. '50 AgriMarts by Q3') is contradicted in a later meeting ('42 AgriMarts in pipeline') without acknowledgment, it's flagged. Severity is rated by the impact and how silent the drift is.",
  logframe:
    "World Bank logframe coverage. Each indicator's evidence and verification status, mapped from raw documents to logframe outputs by Scout's pixel-coordinate vision and Drafter's structured output.",
  documents:
    "Source documents ingested by the pipeline. Forms, transcripts, and CSV exports \u2014 synthetic for this hackathon demo. Each document is processed by Scout (vision) or Scribe (text) and contributes evidence to the project memory.",
  engine:
    "The six agents that make Poneglyph work, plus token usage and live status. Click 'Run pipeline' to trigger the canonical demo flow end-to-end on synthetic World Bank project data.",
} as const;

/** Section IDs for IntersectionObserver scroll tracking. */
const SECTION_IDS = [
  "overview",
  "briefings",
  "drift",
  "logframe",
  "documents",
  "engine",
] as const;

// ── Demo data for static sections ─────────────────────────────

const HERO_STATS = {
  verifiedPercent: 88,
  evidenceItems: 18,
  commitments: 19,
  driftFlags: 3,
  meetings: 2,
} as const;

const DEMO_DRIFT = [
  {
    topic: "AgriMarts target",
    meetings: ["Kickoff (Oct)", "Review 1 (Dec)", "Q1 Review (Mar)"],
    values: ["50 planned", "50 confirmed", "42 mentioned"],
    severity: "high" as const,
    delta: "50 \u2192 42",
    note: "Silent walk-back: target reduced without formal revision",
  },
  {
    topic: "Women PHM training",
    meetings: ["Kickoff (Oct)", "Review 1 (Dec)", "Q1 Review (Mar)"],
    values: ["500 women", "500 women", "478 logged"],
    severity: "low" as const,
    delta: "On track",
    note: "4% gap — likely data lag, not drift",
  },
  {
    topic: "Cold storage facilities",
    meetings: ["Kickoff (Oct)", "Review 1 (Dec)", "Q1 Review (Mar)"],
    values: ["4 planned", "3 funded", "1 verified"],
    severity: "medium" as const,
    delta: "4 \u2192 1 verified",
    note: "Rehli operational; 3 others lack evidence",
  },
] as const;

const DEMO_LOGFRAME = [
  {
    output: "Output 1: Market Access Infrastructure",
    indicators: [
      { name: "AgriMarts established", target: 50, current: 42, verified: 38 },
      { name: "Salepoints operational", target: 200, current: 164, verified: 112 },
      { name: "FPCs with market linkages", target: 15, current: 12, verified: 12 },
    ],
  },
  {
    output: "Output 2: Capacity Building",
    indicators: [
      { name: "Women trained in PHM", target: 500, current: 478, verified: 410 },
      { name: "Lead farmers identified", target: 100, current: 87, verified: 72 },
    ],
  },
  {
    output: "Output 3: Infrastructure",
    indicators: [
      { name: "Cold storage facilities", target: 4, current: 1, verified: 1 },
      { name: "Processing units set up", target: 8, current: 5, verified: 3 },
    ],
  },
] as const;

const DEMO_DOCUMENTS = [
  { name: "Q1 Review MoM", type: "Meeting", date: "Mar 2026", pages: 4 },
  { name: "Rehli Cold Storage Inspection", type: "Field Form", date: "Feb 2026", pages: 2 },
  { name: "PHM Attendance — Gumla", type: "Field Form", date: "Feb 2026", pages: 3 },
  { name: "FPC Registration Summary", type: "Report", date: "Jan 2026", pages: 8 },
  { name: "Kickoff MoM", type: "Meeting", date: "Oct 2025", pages: 6 },
  { name: "AgriMart Site Photos", type: "Evidence", date: "Mar 2026", pages: 12 },
] as const;

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [engineExpanded, setEngineExpanded] = useState(false);

  /* Briefing generation state — lives here so it persists across modal open/close. */
  const [briefingState, setBriefingState] = useState<BriefingState>({
    kind: "idle",
  });
  const [stakeholder, setStakeholder] = useState<string>(
    STAKEHOLDER_OPTIONS[0]
  );
  const [meetingContext, setMeetingContext] = useState("");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  /* Rotate loading messages. */
  useEffect(() => {
    if (briefingState.kind !== "loading") return;
    setLoadingMessageIndex(0);
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, LOADING_ROTATION_MS);
    return () => clearInterval(interval);
  }, [briefingState.kind]);

  /* IntersectionObserver to track which section is in view. */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const handleGenerate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBriefingState({ kind: "loading" });

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
      setBriefingState({ kind: "display", briefing: data });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setBriefingState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Failed to generate briefing",
      });
    }
  }, [stakeholder, meetingContext]);

  const handleBriefingReset = useCallback(() => {
    abortRef.current?.abort();
    setBriefingState({ kind: "idle" });
    setMeetingContext("");
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    /* Auto-expand Engine section when navigating to it. */
    if (sectionId === "engine") {
      setEngineExpanded(true);
    }
    /* Small delay when expanding engine to let React render before scrolling. */
    const delay = sectionId === "engine" ? 100 : 0;
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    }, delay);
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <AppNav
        activeSection={activeSection}
        onCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onBriefMe={() => setBriefingModalOpen(true)}
        onNavigate={scrollToSection}
      />

      {/* ── Main content ── */}
      <main className="mx-auto max-w-[1080px] px-6 pb-20 pt-8">
        {/* Section 1: Page header */}
        <section id="overview" className="mb-10">
          <PageHeader />
        </section>

        {/* Section 2: Hero stat block */}
        <section className="mb-10">
          <HeroStatBlock onBriefMe={() => setBriefingModalOpen(true)} />
        </section>

        {/* Section 3: Briefing card */}
        <section id="briefings" className="mb-10">
          <BriefingCard
            briefingState={briefingState}
            onOpenModal={() => setBriefingModalOpen(true)}
          />
        </section>

        {/* Section 4: Drift */}
        <section id="drift" className="mb-10">
          <DriftSection />
        </section>

        {/* Section 5: Logframe coverage */}
        <section id="logframe" className="mb-10">
          <LogframeSection />
        </section>

        {/* Section 6: Documents grid */}
        <section id="documents" className="mb-10">
          <DocumentsGrid />
        </section>

        {/* Section 7: Engine (collapsible) */}
        <section id="engine" className="mb-10">
          <EngineSection
            expanded={engineExpanded}
            onToggle={() => setEngineExpanded((prev) => !prev)}
          />
        </section>
      </main>

      {/* Briefing modal */}
      <BriefingModal
        isOpen={briefingModalOpen}
        onClose={() => setBriefingModalOpen(false)}
        briefingState={briefingState}
        stakeholder={stakeholder}
        onStakeholderChange={setStakeholder}
        meetingContext={meetingContext}
        onMeetingContextChange={setMeetingContext}
        loadingMessageIndex={loadingMessageIndex}
        onGenerate={handleGenerate}
        onReset={handleBriefingReset}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 1: Page header
// ─────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <h1 className="text-lg font-semibold text-text-primary">
        Madhya Pradesh Farmer Producer Company
      </h1>
      <span className="rounded-full bg-highlight-mint px-2.5 py-0.5 text-2xs font-medium text-accent-forest">
        Active
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 2: Hero stat block with circular progress arc
// ─────────────────────────────────────────────────────────────

function HeroStatBlock({ onBriefMe }: { onBriefMe: () => void }) {
  const { verifiedPercent, evidenceItems, commitments, driftFlags, meetings } =
    HERO_STATS;

  /* SVG arc math for the circular progress indicator.
     Radius 54, stroke 8, viewBox 128x128. */
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (verifiedPercent / 100) * circumference;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-8">
      <div className="flex items-center gap-10">
        {/* Circular arc */}
        <div className="relative flex shrink-0 items-center justify-center">
          <svg width="128" height="128" viewBox="0 0 128 128">
            {/* Background ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="#E7E5DF"
              strokeWidth="8"
            />
            {/* Progress arc */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="#15803D"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 64 64)"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-bold text-text-primary">
              {verifiedPercent}%
            </span>
            <span className="flex items-center text-[10px] text-text-tertiary">
              verified
              <InfoPopover content={TOOLTIPS.heroStat} />
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-x-10 gap-y-5">
            <StatItem label="Evidence items" value={evidenceItems} />
            <StatItem label="Commitments tracked" value={commitments} />
            <StatItem label="Drift flags" value={driftFlags} accent="amber" />
            <StatItem label="Meetings processed" value={meetings} />
          </div>

          <div className="mt-6">
            <button
              onClick={onBriefMe}
              className="rounded-lg bg-accent-forest px-5 py-2.5 text-2xs font-medium text-white transition-colors hover:bg-accent-forest-hover"
            >
              Brief me for the next meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber";
}) {
  return (
    <div>
      <p
        className={`font-mono text-lg font-semibold ${
          accent === "amber" ? "text-accent-amber" : "text-text-primary"
        }`}
      >
        {value}
      </p>
      <p className="text-2xs text-text-tertiary">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 3: Briefing card
// ─────────────────────────────────────────────────────────────

function BriefingCard({
  briefingState,
  onOpenModal,
}: {
  briefingState: BriefingState;
  onOpenModal: () => void;
}) {
  return (
    <div>
      <SectionHeader title="Briefings" tooltip={TOOLTIPS.briefings} />

      {briefingState.kind === "display" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-2xs text-text-secondary">
              Latest: {briefingState.briefing.stakeholder}
              {briefingState.briefing.meeting_context &&
                ` \u2014 ${briefingState.briefing.meeting_context}`}
            </p>
            <button
              onClick={onOpenModal}
              className="text-2xs font-medium text-accent-forest hover:text-accent-forest-hover"
            >
              Generate new
            </button>
          </div>

          {/* Project summary */}
          <p
            className="text-sm text-text-secondary"
            style={{ lineHeight: 1.7 }}
          >
            {briefingState.briefing.project_summary}
          </p>

          {/* Stacked sections */}
          <BriefingSectionInline
            title="Push for"
            accentColor="forest"
            items={briefingState.briefing.push_for}
          />
          <BriefingSectionInline
            title="They'll push back on"
            accentColor="amber"
            items={briefingState.briefing.push_back_on_us}
          />
          <BriefingSectionInline
            title="Don't bring up"
            accentColor="muted"
            items={briefingState.briefing.do_not_bring_up}
          />

          {/* Closing note */}
          <div className="border-t border-hairline pt-4">
            <p
              className="text-2xs italic text-text-tertiary"
              style={{ lineHeight: 1.6 }}
            >
              {briefingState.briefing.closing_note}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">
            No briefing generated yet
          </p>
          <p className="mt-1 text-2xs text-text-tertiary">
            Generate a stakeholder briefing to see push-for, push-back, and
            what to avoid
          </p>
          <button
            onClick={onOpenModal}
            className="mt-4 rounded-lg bg-accent-forest px-5 py-2.5 text-2xs font-medium text-white transition-colors hover:bg-accent-forest-hover"
          >
            Brief me...
          </button>
        </div>
      )}
    </div>
  );
}

function BriefingSectionInline({
  title,
  accentColor,
  items,
}: {
  title: string;
  accentColor: "forest" | "amber" | "muted";
  items: BriefingItemData[];
}) {
  const colors = {
    forest: { dot: "bg-accent-forest", border: "border-accent-forest/20" },
    amber: { dot: "bg-accent-amber", border: "border-accent-amber/20" },
    muted: { dot: "bg-text-tertiary", border: "border-hairline" },
  }[accentColor];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
        <h4 className="text-2xs font-semibold text-text-primary">{title}</h4>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`rounded-lg border ${colors.border} bg-surface p-4`}
          >
            <p
              className="text-sm text-text-primary"
              style={{ lineHeight: 1.6 }}
            >
              {highlightNumbers(item.text)}
            </p>
            <p
              className="mt-2 text-2xs italic text-text-tertiary"
              style={{ lineHeight: 1.6 }}
            >
              {item.rationale}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.citations.map((cid) => (
                <span
                  key={cid}
                  className="rounded border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary"
                >
                  {cid}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Highlight numbers in briefing prose with monospace + green accent.
 *
 * Matches patterns like "88%", "42 AgriMarts", "₹1.2 crore", "50 → 42".
 * Returns a mix of plain text and styled <span> elements.
 */
function highlightNumbers(text: string): React.ReactNode {
  const parts = text.split(/(\d[\d,.]*%?(?:\s*[→\u2192]\s*\d[\d,.]*%?)?)/g);
  return parts.map((part, i) =>
    /\d/.test(part) ? (
      <span
        key={i}
        className="font-mono font-semibold text-accent-forest"
      >
        {part}
      </span>
    ) : (
      part
    )
  );
}

// ─────────────────────────────────────────────────────────────
// Section 4: Drift
// ─────────────────────────────────────────────────────────────

function DriftSection() {
  return (
    <div>
      <SectionHeader title="Drift" tooltip={TOOLTIPS.drift} />
      <div className="space-y-4">
        {DEMO_DRIFT.map((row) => (
          <DriftRow key={row.topic} row={row} />
        ))}
      </div>
    </div>
  );
}

function DriftRow({
  row,
}: {
  row: (typeof DEMO_DRIFT)[number];
}) {
  const severityColors = {
    high: {
      bg: "bg-red-50",
      border: "border-accent-critical/20",
      badge: "bg-red-100 text-accent-critical",
    },
    medium: {
      bg: "bg-amber-50",
      border: "border-accent-amber/20",
      badge: "bg-amber-100 text-accent-amber",
    },
    low: {
      bg: "bg-canvas",
      border: "border-hairline",
      badge: "bg-highlight-mint text-accent-forest",
    },
  }[row.severity];

  return (
    <div
      className={`rounded-xl border ${severityColors.border} ${severityColors.bg} p-5`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-text-primary">
              {row.topic}
            </h4>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${severityColors.badge}`}
            >
              {row.severity}
            </span>
          </div>
          <p className="mt-1 text-2xs text-text-secondary">{row.note}</p>
        </div>
        <span className="shrink-0 font-mono text-xs font-semibold text-text-primary">
          {row.delta}
        </span>
      </div>

      {/* SVG timeline */}
      <div className="mt-4">
        <svg
          width="100%"
          height="40"
          viewBox="0 0 600 40"
          preserveAspectRatio="xMidYMid meet"
          className="overflow-visible"
        >
          {/* Connector line */}
          <line
            x1="40"
            y1="20"
            x2="560"
            y2="20"
            stroke={
              row.severity === "high"
                ? "#991B1B"
                : row.severity === "medium"
                ? "#B45309"
                : "#15803D"
            }
            strokeWidth="2"
            strokeDasharray={row.severity === "low" ? "none" : "6 4"}
          />

          {/* Nodes */}
          {row.meetings.map((meeting, i) => {
            const x = 40 + (i * 520) / (row.meetings.length - 1);
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy="20"
                  r="5"
                  fill="white"
                  stroke={
                    row.severity === "high"
                      ? "#991B1B"
                      : row.severity === "medium"
                      ? "#B45309"
                      : "#15803D"
                  }
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y="6"
                  textAnchor="middle"
                  className="fill-text-tertiary text-[9px]"
                >
                  {meeting}
                </text>
                <text
                  x={x}
                  y="36"
                  textAnchor="middle"
                  className="fill-text-primary text-[10px] font-medium"
                >
                  {row.values[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 5: Logframe coverage
// ─────────────────────────────────────────────────────────────

function LogframeSection() {
  return (
    <div>
      <SectionHeader title="Logframe Coverage" tooltip={TOOLTIPS.logframe} />
      <div className="space-y-6">
        {DEMO_LOGFRAME.map((group) => (
          <div key={group.output}>
            <h4 className="mb-3 text-2xs font-semibold text-text-secondary">
              {group.output}
            </h4>
            <div className="space-y-2">
              {group.indicators.map((ind) => {
                const progress = Math.round((ind.current / ind.target) * 100);
                const verifiedProgress = Math.round(
                  (ind.verified / ind.target) * 100
                );
                return (
                  <div
                    key={ind.name}
                    className="rounded-lg border border-hairline bg-surface p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-medium text-text-primary">
                        {ind.name}
                      </span>
                      <span className="font-mono text-2xs text-text-tertiary">
                        {ind.current}/{ind.target}
                      </span>
                    </div>
                    {/* Stacked progress bars: reported (light) + verified (solid) */}
                    <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-canvas">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-accent-forest/20"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-accent-forest"
                        style={{ width: `${Math.min(verifiedProgress, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex gap-4 text-[10px] text-text-tertiary">
                      <span>{ind.verified} verified</span>
                      <span>{ind.current - ind.verified} unverified</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 6: Documents grid
// ─────────────────────────────────────────────────────────────

function DocumentsGrid() {
  return (
    <div>
      <SectionHeader title="Documents" tooltip={TOOLTIPS.documents} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {DEMO_DOCUMENTS.map((doc) => {
          const typeColors: Record<string, string> = {
            Meeting: "bg-blue-50 text-blue-700",
            "Field Form": "bg-highlight-mint text-accent-forest",
            Report: "bg-amber-50 text-accent-amber",
            Evidence: "bg-purple-50 text-purple-700",
          };
          return (
            <div
              key={doc.name}
              className="rounded-xl border border-hairline bg-surface p-4 transition-colors hover:bg-hover-warm"
            >
              {/* Document icon */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-2 text-text-tertiary"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p className="truncate text-2xs font-medium text-text-primary">
                {doc.name}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    typeColors[doc.type] ?? "bg-canvas text-text-tertiary"
                  }`}
                >
                  {doc.type}
                </span>
                <span className="text-[10px] text-text-tertiary">
                  {doc.date}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Briefing modal
// ─────────────────────────────────────────────────────────────

interface BriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  briefingState: BriefingState;
  stakeholder: string;
  onStakeholderChange: (value: string) => void;
  meetingContext: string;
  onMeetingContextChange: (value: string) => void;
  loadingMessageIndex: number;
  onGenerate: () => void;
  onReset: () => void;
}

function BriefingModal({
  isOpen,
  onClose,
  briefingState,
  stakeholder,
  onStakeholderChange,
  meetingContext,
  onMeetingContextChange,
  loadingMessageIndex,
  onGenerate,
  onReset,
}: BriefingModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-[10%] z-[81] max-h-[80vh] w-[640px] -translate-x-1/2 overflow-y-auto rounded-xl border border-hairline bg-surface p-6 shadow-lg"
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">
                Generate Briefing
              </h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-hover-warm hover:text-text-primary"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {briefingState.kind === "idle" && (
                <motion.div
                  key="modal-idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="mb-1.5 block text-2xs text-text-secondary">
                      Stakeholder
                    </label>
                    <select
                      value={stakeholder}
                      onChange={(e) => onStakeholderChange(e.target.value)}
                      className="h-9 w-full rounded-lg border border-hairline bg-canvas px-3 text-2xs text-text-primary outline-none focus:border-accent-forest"
                    >
                      {STAKEHOLDER_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-2xs text-text-secondary">
                      Meeting context{" "}
                      <span className="text-text-tertiary">(optional)</span>
                    </label>
                    <input
                      placeholder="e.g. Quarterly progress review — Q1 FY2026"
                      value={meetingContext}
                      onChange={(e) => onMeetingContextChange(e.target.value)}
                      className="h-9 w-full rounded-lg border border-hairline bg-canvas px-3 text-2xs text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-forest"
                    />
                  </div>

                  <button
                    onClick={onGenerate}
                    className="w-full rounded-lg bg-accent-forest py-2.5 text-2xs font-medium text-white transition-colors hover:bg-accent-forest-hover"
                  >
                    Generate briefing
                  </button>
                </motion.div>
              )}

              {briefingState.kind === "loading" && (
                <motion.div
                  key="modal-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-5 py-10"
                >
                  {/* Pulsing dot */}
                  <div className="relative h-5 w-5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-accent-forest/30" />
                    <span className="absolute inset-1 rounded-full bg-accent-forest" />
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={loadingMessageIndex}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-text-secondary"
                    >
                      {LOADING_MESSAGES[loadingMessageIndex]}
                    </motion.p>
                  </AnimatePresence>

                  <p className="text-2xs text-text-tertiary">
                    This takes 30&ndash;60 seconds
                  </p>

                  <button
                    onClick={() => {
                      onReset();
                    }}
                    className="text-2xs text-text-tertiary transition-colors hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}

              {briefingState.kind === "display" && (
                <motion.div
                  key="modal-display"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-text-secondary" style={{ lineHeight: 1.7 }}>
                    {briefingState.briefing.project_summary}
                  </p>

                  <BriefingSectionInline
                    title="Push for"
                    accentColor="forest"
                    items={briefingState.briefing.push_for}
                  />
                  <BriefingSectionInline
                    title="They'll push back on"
                    accentColor="amber"
                    items={briefingState.briefing.push_back_on_us}
                  />
                  <BriefingSectionInline
                    title="Don't bring up"
                    accentColor="muted"
                    items={briefingState.briefing.do_not_bring_up}
                  />

                  <div className="border-t border-hairline pt-4">
                    <p
                      className="text-2xs italic text-text-tertiary"
                      style={{ lineHeight: 1.6 }}
                    >
                      {briefingState.briefing.closing_note}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={onReset}
                      className="rounded-lg bg-accent-forest px-5 py-2.5 text-2xs font-medium text-white transition-colors hover:bg-accent-forest-hover"
                    >
                      Generate another
                    </button>
                    <button
                      onClick={onClose}
                      className="rounded-lg border border-hairline px-5 py-2.5 text-2xs font-medium text-text-secondary transition-colors hover:bg-hover-warm"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}

              {briefingState.kind === "error" && (
                <motion.div
                  key="modal-error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 py-4"
                >
                  <p className="text-sm font-medium text-accent-critical">
                    Briefing generation failed
                  </p>
                  <p className="text-2xs text-text-secondary">
                    {briefingState.message}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={onGenerate}
                      className="rounded-lg bg-accent-forest px-5 py-2.5 text-2xs font-medium text-white transition-colors hover:bg-accent-forest-hover"
                    >
                      Retry
                    </button>
                    <button
                      onClick={onReset}
                      className="text-2xs text-text-tertiary transition-colors hover:text-text-primary"
                    >
                      Back
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 7: Engine (collapsible, embeds /demo dashboard)
// ─────────────────────────────────────────────────────────────

function EngineSection({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionHeader title="Engine" tooltip={TOOLTIPS.engine} />
        <button
          onClick={onToggle}
          className="text-2xs font-medium text-accent-forest transition-colors hover:text-accent-forest-hover"
        >
          {expanded ? "Hide engine" : "Show engine \u2192"}
        </button>
      </div>

      {!expanded && (
        <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">
            See the agents at work
          </p>
          <p className="mt-1 text-2xs text-text-tertiary">
            Run the 6-agent pipeline on synthetic World Bank project data.
            Watch Scout extract evidence, Scribe process meetings, and Auditor
            verify claims.
          </p>
          <button
            onClick={onToggle}
            className="mt-4 rounded-lg bg-accent-forest px-5 py-2.5 text-2xs font-medium text-white transition-colors hover:bg-accent-forest-hover"
          >
            Show engine
          </button>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {/*
             * warm-engine class overrides CSS variables so shadcn
             * components inside the demo page render in the warm palette
             * instead of dark zinc. See globals.css.
             */}
            <div className="warm-engine rounded-xl border border-hairline [&>div]:h-[800px] [&>div]:rounded-xl [&>div]:border-0">
              <EngineDashboard />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  tooltip,
}: {
  title: string;
  tooltip?: string;
}) {
  return (
    <h3 className="mb-4 flex items-center text-xs font-semibold uppercase tracking-wider text-text-tertiary">
      {title}
      {tooltip && <InfoPopover content={tooltip} />}
    </h3>
  );
}
