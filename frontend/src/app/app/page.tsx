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
  meetings: 2,
} as const;

/**
 * Actual logframe outputs from backend/data/projects/mp-fpc-2024/logframe.md.
 * These are the real MP-FPC indicators — not placeholders.
 */
const LOGFRAME_INDICATORS = [
  {
    output: "Output 1: Farmer Producer Companies Established",
    indicators: [
      { id: "1.1", name: "FPCs registered", target: "15 FPCs" },
      { id: "1.2", name: "Farmers enrolled", target: "10,000 farmers" },
      { id: "1.3", name: "Women farmer participation", target: "30%" },
    ],
  },
  {
    output: "Output 2: Infrastructure Development",
    indicators: [
      { id: "2.1", name: "Cold storage facilities", target: "5 facilities" },
      { id: "2.2", name: "Sale points operational", target: "20 sale points" },
    ],
  },
  {
    output: "Output 3: Capacity Building",
    indicators: [
      { id: "3.1", name: "PHM trainings conducted", target: "50 trainings" },
      { id: "3.2", name: "Women\u2019s PHM trainings", target: "20 trainings" },
      { id: "3.3", name: "Stakeholders trained", target: "1,000 people" },
    ],
  },
] as const;

/** A drift item built from real contradiction detection output. */
interface DriftItem {
  topic: string;
  meetings: string[];
  values: string[];
  severity: "high" | "medium" | "low";
  delta: string;
  note: string;
}

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

  /* Data piped from the Engine dashboard after pipeline runs.
     These replace the former DEMO_DRIFT / DEMO_LOGFRAME constants.
     Data arrives via custom window events dispatched by the Engine. */
  const [driftItems, setDriftItems] = useState<DriftItem[]>([]);
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>(
    {}
  );
  const [verificationCounts, setVerificationCounts] = useState<
    Record<
      string,
      { verified: number; unsupported: number; contested: number }
    >
  >({});

  /* Listen for pipeline events dispatched by the Engine dashboard. */
  useEffect(() => {
    function onContradictions(e: Event) {
      const items = (e as CustomEvent).detail as Array<
        Record<string, unknown>
      >;
      const mapped: DriftItem[] = items.map((c) => {
        const earlierClaim = (c.earlier_claim as string) || "";
        const laterClaim = (c.later_claim as string) || "";
        return {
          topic: (c.description as string) || "Unknown",
          meetings: [
            (c.earlier_source as string) || "Meeting 1",
            (c.later_source as string) || "Meeting 2",
          ],
          values: [earlierClaim, laterClaim],
          severity:
            (c.severity as "high" | "medium" | "low") || "medium",
          delta: `${earlierClaim} \u2192 ${laterClaim}`,
          note: (c.description as string) || "",
        };
      });
      setDriftItems(mapped);
    }

    function onEvidence(e: Event) {
      setEvidenceCounts((e as CustomEvent).detail);
    }

    function onVerification(e: Event) {
      setVerificationCounts((e as CustomEvent).detail);
    }

    window.addEventListener("poneglyph:contradictions", onContradictions);
    window.addEventListener("poneglyph:evidence", onEvidence);
    window.addEventListener("poneglyph:verification", onVerification);
    return () => {
      window.removeEventListener(
        "poneglyph:contradictions",
        onContradictions
      );
      window.removeEventListener("poneglyph:evidence", onEvidence);
      window.removeEventListener("poneglyph:verification", onVerification);
    };
  }, []);

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
      <main className="mx-auto max-w-[1296px] px-6 pb-20 pt-8">
        {/* Section 1: Page header */}
        <section id="overview" className="mb-10">
          <PageHeader />
        </section>

        {/* Section 2: Hero stat block */}
        <section className="mb-10">
          <HeroStatBlock onBriefMe={() => setBriefingModalOpen(true)} driftFlags={driftItems.length} />
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
          <DriftSection driftItems={driftItems} />
        </section>

        {/* Section 5: Logframe coverage */}
        <section id="logframe" className="mb-10">
          <LogframeSection
            evidenceCounts={evidenceCounts}
            verificationCounts={verificationCounts}
          />
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

function HeroStatBlock({ onBriefMe, driftFlags }: { onBriefMe: () => void; driftFlags: number }) {
  const { verifiedPercent, evidenceItems, commitments, meetings } =
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
        <div className="rounded-xl border border-accent-forest/20 bg-surface p-6">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-text-primary">
                {briefingState.briefing.stakeholder} Briefing
              </h4>
              {briefingState.briefing.meeting_context && (
                <p className="mt-0.5 text-2xs text-text-secondary">
                  {briefingState.briefing.meeting_context}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-2xs text-text-tertiary">
                View past briefings
              </span>
              <button
                onClick={onOpenModal}
                className="text-2xs font-medium text-accent-forest transition-colors hover:text-accent-forest-hover"
              >
                Generate new
              </button>
            </div>
          </div>

          {/* Project summary */}
          <p
            className="text-sm text-text-secondary"
            style={{ lineHeight: 1.7 }}
          >
            {briefingState.briefing.project_summary}
          </p>

          {/* Stacked sections */}
          <div className="mt-5 space-y-4">
            <BriefingSectionInline
              title="Push for"
              accentColor="forest"
              items={briefingState.briefing.push_for}
            />
            <BriefingSectionInline
              title="They&apos;ll push back on"
              accentColor="amber"
              items={briefingState.briefing.push_back_on_us}
            />
            <BriefingSectionInline
              title="Don&apos;t bring up"
              accentColor="muted"
              items={briefingState.briefing.do_not_bring_up}
            />
          </div>

          {/* Closing note */}
          <div className="mt-5 border-t border-hairline pt-4">
            <p
              className="text-2xs italic text-text-tertiary"
              style={{ lineHeight: 1.6 }}
            >
              {briefingState.briefing.closing_note}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-accent-forest/30 bg-highlight-mint/30 p-8 text-center">
          {/* Briefing icon */}
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-forest/10">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent-forest"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-text-primary">
            Prepare for your next meeting
          </h4>
          <p className="mx-auto mt-1 max-w-md text-2xs text-text-secondary">
            Generate a stakeholder briefing grounded in project evidence
            &mdash; what to push for, what they&apos;ll push back on, and what
            not to bring up.
          </p>
          <button
            onClick={onOpenModal}
            className="mt-4 rounded-lg bg-accent-forest px-5 py-2.5 text-2xs font-medium text-white transition-colors hover:bg-accent-forest-hover"
          >
            Generate briefing
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

function DriftSection({ driftItems }: { driftItems: DriftItem[] }) {
  return (
    <div>
      <SectionHeader title="Drift" tooltip={TOOLTIPS.drift} />

      {driftItems.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">
            No drift detected yet
          </p>
          <p className="mt-1 text-2xs text-text-tertiary">
            Run the pipeline to detect silent walk-backs across meetings
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {driftItems.map((row) => (
            <DriftCard key={row.topic} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function DriftCard({ row }: { row: DriftItem }) {
  const [expanded, setExpanded] = useState(false);

  const severityBadge = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700",
  }[row.severity];

  const lineColor = {
    high: "#DC2626",
    medium: "#D97706",
    low: "#15803D",
  }[row.severity];

  const truncate = (s: string, max: number) =>
    s.length > max ? s.slice(0, max) + "\u2026" : s;

  const hasLongQuotes =
    row.values[0]?.length > 30 || row.values[1]?.length > 30;

  return (
    <div
      className="rounded-xl bg-surface p-4"
      style={{ border: "0.5px solid #E7E5DF" }}
    >
      {/* 1. Header: topic + severity badge + short delta */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">
            {row.topic}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${severityBadge}`}
          >
            {row.severity}
          </span>
        </div>
        <span className="shrink-0 font-mono text-xs font-semibold text-text-primary">
          {truncate(row.delta, 30)}
        </span>
      </div>

      {/* 2. Description (max 2 lines) */}
      <p
        className="mt-1.5 line-clamp-2 text-[13px]"
        style={{ color: "#5C5F5A", lineHeight: 1.5 }}
      >
        {row.note}
      </p>

      {/* 3. SVG timeline — 2 nodes, line bends at second node */}
      {row.meetings.length >= 2 && (
        <div className="mt-3">
          <svg
            width="100%"
            height="72"
            viewBox="0 0 400 72"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Connector: dashed line bending down to node 2 */}
            <path
              d="M 60 32 L 200 32 L 340 38"
              fill="none"
              stroke={lineColor}
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />

            {/* Node 1 */}
            <circle cx="60" cy="32" r="4" fill="white" stroke={lineColor} strokeWidth="1.5" />
            <text x="60" y="14" textAnchor="middle" fontSize="10" fontFamily="var(--font-geist-mono)" fill="#8C8C8C">
              {row.meetings[0]}
            </text>
            <text x="60" y="56" textAnchor="middle" fontSize="10" fontFamily="var(--font-geist-mono)" fill="#3D3D3D">
              {truncate(row.values[0], 28)}
            </text>

            {/* Node 2 (shifted down to show drift) */}
            <circle cx="340" cy="38" r="4" fill="white" stroke={lineColor} strokeWidth="1.5" />
            <text x="340" y="14" textAnchor="middle" fontSize="10" fontFamily="var(--font-geist-mono)" fill="#8C8C8C">
              {row.meetings[1]}
            </text>
            <text x="340" y="62" textAnchor="middle" fontSize="10" fontFamily="var(--font-geist-mono)" fill="#3D3D3D">
              {truncate(row.values[1], 28)}
            </text>
          </svg>
        </div>
      )}

      {/* 4. Citation chips + expand link */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {row.meetings.map((m) => (
            <span
              key={m}
              className="rounded border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary"
            >
              {m}
            </span>
          ))}
        </div>
        {hasLongQuotes && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-[11px] text-text-tertiary transition-colors hover:text-text-primary"
          >
            {expanded ? "Hide quotes" : "View source quotes"}
          </button>
        )}
      </div>

      {/* Expandable source quotes */}
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-hairline pt-3">
          <div className="rounded-lg bg-canvas p-3">
            <p className="mb-1 text-[10px] font-medium text-text-tertiary">
              {row.meetings[0]}
            </p>
            <p className="text-2xs text-text-secondary" style={{ lineHeight: 1.5 }}>
              &ldquo;{row.values[0]}&rdquo;
            </p>
          </div>
          {row.meetings[1] && (
            <div className="rounded-lg bg-canvas p-3">
              <p className="mb-1 text-[10px] font-medium text-text-tertiary">
                {row.meetings[1]}
              </p>
              <p className="text-2xs text-text-secondary" style={{ lineHeight: 1.5 }}>
                &ldquo;{row.values[1]}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 5: Logframe coverage
// ─────────────────────────────────────────────────────────────

function LogframeSection({
  evidenceCounts,
  verificationCounts,
}: {
  evidenceCounts: Record<string, number>;
  verificationCounts: Record<
    string,
    { verified: number; unsupported: number; contested: number }
  >;
}) {
  const hasEvidence = Object.keys(evidenceCounts).length > 0;

  return (
    <div>
      <SectionHeader title="Logframe Coverage" tooltip={TOOLTIPS.logframe} />

      {!hasEvidence ? (
        <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">
            No evidence mapped yet
          </p>
          <p className="mt-1 text-2xs text-text-tertiary">
            Run the pipeline to map field evidence to logframe indicators
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {LOGFRAME_INDICATORS.map((group) => (
            <div key={group.output}>
              <h4 className="mb-3 text-2xs font-semibold text-text-secondary">
                {group.output}
              </h4>
              <div className="space-y-2">
                {group.indicators.map((ind) => {
                  /* Evidence keys from Scout use "Output X.Y" format
                     (e.g. "Output 1.2"), matching the logframe_indicator
                     field in the backend memory model. */
                  const key = `Output ${ind.id}`;
                  const count = evidenceCounts[key] || 0;
                  const vc = verificationCounts[key];
                  const verified = vc?.verified || 0;
                  const contested = vc?.contested || 0;
                  const unsupported = vc?.unsupported || 0;
                  /* Scale bar to whichever is larger: evidence count or 5 (minimum visible range). */
                  const barMax = Math.max(count, 5);
                  const totalProgress = Math.round(
                    (count / barMax) * 100
                  );
                  const verifiedProgress = Math.round(
                    (verified / barMax) * 100
                  );

                  return (
                    <div
                      key={ind.id}
                      className="rounded-lg border border-hairline bg-surface p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xs text-text-tertiary">
                            {ind.id}
                          </span>
                          <span className="text-2xs font-medium text-text-primary">
                            {ind.name}
                          </span>
                        </div>
                        <span className="font-mono text-2xs text-text-tertiary">
                          Target: {ind.target}
                        </span>
                      </div>

                      {/* Evidence count + verification breakdown */}
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="font-mono text-2xs font-medium text-accent-forest">
                          {count} evidence item{count !== 1 ? "s" : ""}
                        </span>
                        {count > 0 && (
                          <span className="text-[10px] text-text-tertiary">
                            {verified > 0 && `${verified} \u2713`}
                            {contested > 0 && ` ${contested} \u26A0`}
                            {unsupported > 0 && ` ${unsupported} \u2717`}
                          </span>
                        )}
                      </div>

                      {/* Progress bar: total (light) + verified (solid) */}
                      {count > 0 && (
                        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-canvas">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-accent-forest/20"
                            style={{
                              width: `${Math.min(totalProgress, 100)}%`,
                            }}
                          />
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-accent-forest"
                            style={{
                              width: `${Math.min(verifiedProgress, 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
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
             * components render in the warm palette, and strips the
             * demo page's standalone chrome (header bar, h-screen,
             * dark background). See globals.css.
             */}
            <div className="warm-engine">
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
