"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/agent-card";
import { MemoryFeed, type MemoryEvent } from "@/components/memory-feed";
import { ImageWithBoxes, type BoundingBox } from "@/components/image-with-boxes";
import { type VerifiedClaim } from "@/components/verified-report-viewer";
import { StreamingText } from "@/components/streaming-text";
import {
  DocumentsPanel,
  type DemoDocument,
} from "@/components/documents-panel";
import {
  LogframeCoverage,
  type OutputGroup,
} from "@/components/logframe-coverage";
import { ReportCard } from "@/components/report-card";
import { DriftTimeline, type DriftRow } from "@/components/drift-timeline";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type AgentStatus = "pending" | "starting" | "running" | "done" | "error";

interface AgentState {
  status: AgentStatus;
  currentAction: string;
  tokensUsed: number;
  budgetTotal: number;
  resultSummary: string;
}

/** Evidence items grouped by image filename. */
interface ImageEvidence {
  imageFilename: string;
  items: Array<{
    id: string;
    summary: string;
    rawText: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    indicator: string;
    boundingBoxes: BoundingBox[];
  }>;
}

/** Draft section from the Drafter (pre-verification). */
interface DraftSection {
  sectionName: string;
  claims: Array<{ text: string; citationIds: string[]; sourceType: string }>;
  gaps: string[];
}

/** Verified section from the Auditor. */
interface VerifiedSection {
  sectionName: string;
  claims: VerifiedClaim[];
  summary: string;
}

/** What the right panel is showing. */
type RightPanelView =
  | { kind: "empty" }
  | { kind: "evidence"; imageFilename: string }
  | { kind: "draft" }
  | { kind: "report" }
  | { kind: "transcript"; documentId: string };

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const AGENT_ORDER = [
  "scout",
  "scribe",
  "archivist",
  "drafter",
  "auditor",
  "orchestrator",
] as const;

type AgentName = (typeof AGENT_ORDER)[number];

const AGENT_META: Record<AgentName, { label: string; budget: number }> = {
  scout: { label: "Scout", budget: 20_000 },
  scribe: { label: "Scribe", budget: 15_000 },
  archivist: { label: "Archivist", budget: 60_000 },
  drafter: { label: "Drafter", budget: 50_000 },
  auditor: { label: "Auditor", budget: 120_000 },
  orchestrator: { label: "Orchestrator", budget: 0 },
};

/** Logframe outputs with numeric targets for fill bar calculation. */
const LOGFRAME_OUTPUTS: OutputGroup[] = [
  {
    id: "Output 1",
    name: "Farmer Producer Companies Established",
    indicators: [
      { id: "1.1", name: "FPCs registered", target: "15 FPCs", targetNumber: 15 },
      { id: "1.2", name: "Farmers enrolled", target: "10,000", targetNumber: 10000 },
      { id: "1.3", name: "Women farmer participation", target: "30%", targetNumber: 30 },
    ],
  },
  {
    id: "Output 2",
    name: "Infrastructure Development",
    indicators: [
      { id: "2.1", name: "Cold storage facilities", target: "5", targetNumber: 5 },
      { id: "2.2", name: "Sale points operational", target: "20", targetNumber: 20 },
    ],
  },
  {
    id: "Output 3",
    name: "Capacity Building",
    indicators: [
      { id: "3.1", name: "PHM trainings conducted", target: "50", targetNumber: 50 },
      { id: "3.2", name: "Women's PHM trainings", target: "20", targetNumber: 20 },
      { id: "3.3", name: "Stakeholders trained", target: "1,000", targetNumber: 1000 },
    ],
  },
];

// Image dimensions (all synthetic forms are 1500x2000)
const IMAGE_WIDTH = 1500;
const IMAGE_HEIGHT = 2000;

/** Pre-populated demo documents — 3 forms + 2 transcripts. */
const INITIAL_DOCUMENTS: DemoDocument[] = [
  {
    id: "doc-form-english",
    filename: "form_english.png",
    type: "form",
    status: "pending",
    evidenceCount: 0,
    thumbnailUrl: `${BACKEND_URL}/static/synthetic/form_english.png`,
  },
  {
    id: "doc-form-hindi",
    filename: "form_hindi.png",
    type: "form",
    status: "pending",
    evidenceCount: 0,
    thumbnailUrl: `${BACKEND_URL}/static/synthetic/form_hindi.png`,
  },
  {
    id: "doc-form-cold-storage",
    filename: "form_cold_storage.png",
    type: "form",
    status: "pending",
    evidenceCount: 0,
    thumbnailUrl: `${BACKEND_URL}/static/synthetic/form_cold_storage.png`,
  },
  {
    id: "doc-meeting-001",
    filename: "meeting_001.txt",
    type: "transcript",
    status: "pending",
    evidenceCount: 0,
    thumbnailUrl: null,
  },
  {
    id: "doc-meeting-002",
    filename: "meeting_002.txt",
    type: "transcript",
    status: "pending",
    evidenceCount: 0,
    thumbnailUrl: null,
  },
];

/** Map Scout/Scribe filenames to document IDs. */
const FILENAME_TO_DOC_ID: Record<string, string> = {
  "form_english.png": "doc-form-english",
  "form_hindi.png": "doc-form-hindi",
  "form_cold_storage.png": "doc-form-cold-storage",
  "meeting_001.txt": "doc-meeting-001",
  "meeting_002.txt": "doc-meeting-002",
};

function initialAgentStates(): Record<AgentName, AgentState> {
  const states: Partial<Record<AgentName, AgentState>> = {};
  for (const name of AGENT_ORDER) {
    states[name] = {
      status: "pending",
      currentAction: "",
      tokensUsed: 0,
      budgetTotal: AGENT_META[name].budget,
      resultSummary: "",
    };
  }
  return states as Record<AgentName, AgentState>;
}

// ─────────────────────────────────────────────────────────────
// Live counter in header — tracks documents, commitments, claims
// ─────────────────────────────────────────────────────────────

interface LiveCounts {
  documentsRead: number;
  commitmentsTracked: number;
  claimsVerified: number;
}

// ─────────────────────────────────────────────────────────────
// Right panel: output viewer
// ─────────────────────────────────────────────────────────────

function OutputPanel({
  view,
  evidenceByImage,
  draftSection,
  verifiedSection,
  selectedBoxId,
  selectedClaimId,
  onBoxClick,
  onClaimClick,
  driftRows,
  isDone,
  animateCounters,
  animateDrift,
}: {
  view: RightPanelView;
  evidenceByImage: Record<string, ImageEvidence>;
  draftSection: DraftSection | null;
  verifiedSection: VerifiedSection | null;
  selectedBoxId: string | null;
  selectedClaimId: string | null;
  onBoxClick: (box: BoundingBox) => void;
  onClaimClick: (claim: VerifiedClaim) => void;
  driftRows: DriftRow[];
  isDone: boolean;
  animateCounters: boolean;
  animateDrift: boolean;
}) {
  if (view.kind === "empty") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-[28ch] text-center text-xs text-zinc-600">
          Run the canonical demo to see agent output here
        </p>
      </div>
    );
  }

  if (view.kind === "evidence") {
    const imgData = evidenceByImage[view.imageFilename];
    if (!imgData) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-zinc-600">Loading evidence...</p>
        </div>
      );
    }

    const allBoxes = imgData.items.flatMap((item) => item.boundingBoxes);
    const imageUrl = `${BACKEND_URL}/static/synthetic/${view.imageFilename}`;

    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-xs font-medium text-zinc-300">
            Scout Evidence
          </h2>
          <p className="font-mono text-2xs text-zinc-600">
            {view.imageFilename}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <ImageWithBoxes
            imageUrl={imageUrl}
            boxes={allBoxes}
            selectedBoxId={selectedBoxId}
            onBoxClick={onBoxClick}
            imageWidth={IMAGE_WIDTH}
            imageHeight={IMAGE_HEIGHT}
          />

          <div className="mt-4 space-y-2">
            {imgData.items.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-zinc-800 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xs text-zinc-600">
                    {item.id}
                  </span>
                  {item.indicator && (
                    <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 font-mono text-2xs text-zinc-400">
                      {item.indicator}
                    </span>
                  )}
                  <span
                    className={`font-mono text-2xs ${
                      item.confidence === "HIGH"
                        ? "text-emerald-400"
                        : item.confidence === "MEDIUM"
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {item.confidence}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-300">{item.summary}</p>
                {item.rawText && (
                  <p className="mt-1 font-mono text-2xs text-zinc-500">
                    &quot;{item.rawText.slice(0, 120)}&quot;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === "draft" && draftSection) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-xs font-medium text-zinc-300">Draft Report</h2>
          <p className="font-mono text-2xs text-zinc-600">
            Awaiting Auditor verification...
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[65ch] space-y-4">
            <h3 className="text-sm font-medium text-zinc-100">
              {draftSection.sectionName}
            </h3>

            <div className="space-y-2">
              {draftSection.claims.map((claim, i) => (
                <p key={i} className="text-xs leading-relaxed text-zinc-400">
                  <StreamingText
                    text={claim.text}
                    msPerWord={30}
                    className="text-xs leading-relaxed text-zinc-400"
                  />
                  <span className="ml-1.5 inline-flex items-center rounded-sm border border-zinc-700 bg-zinc-800/50 px-1 py-0.5 font-mono text-2xs text-zinc-500">
                    {claim.citationIds.length} cite
                    {claim.citationIds.length !== 1 ? "s" : ""}
                  </span>
                </p>
              ))}
            </div>

            {draftSection.gaps.length > 0 && (
              <div className="border-t border-zinc-800 pt-3">
                <p className="mb-1.5 font-mono text-2xs font-medium uppercase tracking-wider text-amber-500">
                  Gaps identified
                </p>
                {draftSection.gaps.map((gap, i) => (
                  <p key={i} className="text-2xs text-zinc-500">
                    {gap}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view.kind === "report" && verifiedSection) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex-1 overflow-y-auto p-4">
          {/* Report card with summary counters */}
          <ReportCard
            sectionName={verifiedSection.sectionName}
            claims={verifiedSection.claims}
            onClaimClick={onClaimClick}
            selectedClaimId={selectedClaimId}
            animateCounters={animateCounters}
          />

          {/* Drift Timeline — shows below the report when done */}
          {driftRows.length > 0 && isDone && (
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Commitment Drift
                </h3>
                <span className="font-mono text-2xs text-zinc-600">
                  {driftRows.reduce((n, r) => n + r.bends.length, 0)} contradiction
                  {driftRows.reduce((n, r) => n + r.bends.length, 0) !== 1
                    ? "s"
                    : ""}{" "}
                  detected
                </span>
              </div>
              <DriftTimeline rows={driftRows} animate={animateDrift} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Main demo page
// ─────────────────────────────────────────────────────────────

export default function DemoPage() {
  // Agent states
  const [agents, setAgents] = useState(initialAgentStates);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Documents panel
  const [documents, setDocuments] = useState<DemoDocument[]>(INITIAL_DOCUMENTS);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );

  // Memory feed (moved to collapsed details)
  const [memoryEvents, setMemoryEvents] = useState<MemoryEvent[]>([]);

  // Evidence data from Scout
  const [evidenceByImage, setEvidenceByImage] = useState<
    Record<string, ImageEvidence>
  >({});
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>(
    {},
  );

  // Verification counts per indicator
  const [verificationCounts, setVerificationCounts] = useState<
    Record<string, { verified: number; unsupported: number; contested: number }>
  >({});

  // Draft section from Drafter (pre-verification)
  const [draftSection, setDraftSection] = useState<DraftSection | null>(null);

  // Verified report from Auditor
  const [verifiedSection, setVerifiedSection] =
    useState<VerifiedSection | null>(null);

  // Drift timeline data — built from contradiction events
  const [driftRows, setDriftRows] = useState<DriftRow[]>([]);

  // Right panel state
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>({
    kind: "empty",
  });
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  // Live counters
  const [liveCounts, setLiveCounts] = useState<LiveCounts>({
    documentsRead: 0,
    commitmentsTracked: 0,
    claimsVerified: 0,
  });

  // Completion choreography state
  const [choreographyPhase, setChoreographyPhase] = useState<
    "idle" | "agents-done" | "coverage-snap" | "drift-draw" | "report-slide" | "counters-tick" | "border-pulse" | "settled"
  >("idle");
  const [animateReportCounters, setAnimateReportCounters] = useState(false);
  const [animateDrift, setAnimateDrift] = useState(false);
  const [showReportCard, setShowReportCard] = useState(false);

  // Selected logframe indicator for filtering
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(
    null,
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const pipelineCompletedRef = useRef(false);
  const memoryEventCounterRef = useRef(0);

  // ─── Completion choreography ───────────────────────────────
  // 7-step sequence over 3.5 seconds, triggered on `done` event.

  const runChoreography = useCallback(() => {
    // t=0: Agent badges fade to done (200ms)
    setChoreographyPhase("agents-done");

    // t=200ms: Coverage bars snap to final values
    setTimeout(() => {
      setChoreographyPhase("coverage-snap");
    }, 200);

    // t=600ms: Drift timeline draws
    setTimeout(() => {
      setChoreographyPhase("drift-draw");
      setAnimateDrift(true);
    }, 600);

    // t=1400ms: Report card slides up
    setTimeout(() => {
      setChoreographyPhase("report-slide");
      setShowReportCard(true);
      setRightPanelView({ kind: "report" });
    }, 1400);

    // t=1750ms: Verification counters tick up
    setTimeout(() => {
      setChoreographyPhase("counters-tick");
      setAnimateReportCounters(true);
    }, 1750);

    // t=2550ms: Border pulse on report card
    setTimeout(() => {
      setChoreographyPhase("border-pulse");
    }, 2550);

    // t=3500ms: Settled
    setTimeout(() => {
      setChoreographyPhase("settled");
    }, 3500);
  }, []);

  // ─── Event handlers ───────────────────────────────────────

  const handleEvent = useCallback(
    (data: Record<string, unknown>) => {
      const eventType = data.type as string;

      if (eventType === "done") {
        pipelineCompletedRef.current = true;
        setIsRunning(false);
        setIsDone(true);

        // Build drift rows from contradiction data if present
        const contradictions = data.contradictions as
          | Array<Record<string, unknown>>
          | undefined;
        if (contradictions && contradictions.length > 0) {
          const rows = buildDriftRows(contradictions);
          setDriftRows(rows);
        }

        // Start completion choreography
        runChoreography();
        return;
      }

      if (eventType === "progress") {
        const agentName = data.agent_name as AgentName;
        if (!AGENT_ORDER.includes(agentName)) return;

        setAgents((prev) => ({
          ...prev,
          [agentName]: {
            status: data.status as AgentStatus,
            currentAction: (data.current_action as string) || "",
            tokensUsed: (data.tokens_used as number) || 0,
            budgetTotal: (data.budget_total as number) || 0,
            resultSummary: (data.result_summary as string) || "",
          },
        }));

        // Update document scanning status based on agent progress
        const currentAction = (data.current_action as string) || "";
        const status = data.status as AgentStatus;

        if (agentName === "scout" && status === "running") {
          // Try to find which document Scout is working on
          for (const [filename, docId] of Object.entries(FILENAME_TO_DOC_ID)) {
            if (
              currentAction.toLowerCase().includes(filename.toLowerCase()) ||
              currentAction.toLowerCase().includes(
                filename.replace(".png", "").replace("_", " "),
              )
            ) {
              setDocuments((prev) =>
                prev.map((d) =>
                  d.id === docId && d.status === "pending"
                    ? { ...d, status: "scanning" as const }
                    : d,
                ),
              );
            }
          }
        }

        if (agentName === "scribe" && status === "running") {
          // Mark transcripts as scanning
          setDocuments((prev) =>
            prev.map((d) =>
              d.type === "transcript" && d.status === "pending"
                ? { ...d, status: "scanning" as const }
                : d,
            ),
          );
        }

        if (
          (agentName === "scout" || agentName === "scribe") &&
          status === "done"
        ) {
          // Mark all docs for this agent as done
          setDocuments((prev) =>
            prev.map((d) => {
              if (agentName === "scout" && d.type === "form" && d.status === "scanning") {
                return { ...d, status: "done" as const };
              }
              if (agentName === "scribe" && d.type === "transcript" && d.status === "scanning") {
                return { ...d, status: "done" as const };
              }
              return d;
            }),
          );
        }

        return;
      }

      if (eventType === "evidence") {
        const filename = data.image_filename as string;
        const rawItems = data.items as Array<Record<string, unknown>>;

        const evidence: ImageEvidence = {
          imageFilename: filename,
          items: rawItems.map((item) => ({
            id: item.id as string,
            summary: item.summary as string,
            rawText: (item.raw_text as string) || "",
            confidence:
              (item.confidence as "HIGH" | "MEDIUM" | "LOW") || "HIGH",
            indicator: (item.indicator as string) || "",
            boundingBoxes: (
              (item.bounding_boxes as Array<Record<string, number>>) || []
            ).map((bb, i) => ({
              id: `${item.id}-bb-${i}`,
              x1: bb.x1 ?? 0,
              y1: bb.y1 ?? 0,
              x2: bb.x2 ?? 0,
              y2: bb.y2 ?? 0,
              label: (item.summary as string) || "",
              confidence:
                (item.confidence as "HIGH" | "MEDIUM" | "LOW") || "HIGH",
            })),
          })),
        };

        setEvidenceByImage((prev) => ({
          ...prev,
          [filename]: evidence,
        }));

        // Update evidence counts by indicator
        setEvidenceCounts((prev) => {
          const next = { ...prev };
          for (const item of evidence.items) {
            if (item.indicator) {
              next[item.indicator] = (next[item.indicator] || 0) + 1;
            }
          }
          return next;
        });

        // Mark this document as done with evidence count
        const docId = FILENAME_TO_DOC_ID[filename];
        if (docId) {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === docId
                ? {
                    ...d,
                    status: "done" as const,
                    evidenceCount: evidence.items.length,
                  }
                : d,
            ),
          );
        }

        // Update live counters
        setLiveCounts((prev) => ({
          ...prev,
          documentsRead: prev.documentsRead + 1,
        }));

        // Auto-show the latest evidence in the right panel
        setRightPanelView({ kind: "evidence", imageFilename: filename });
        return;
      }

      if (eventType === "memory_write") {
        memoryEventCounterRef.current += 1;
        const evt: MemoryEvent = {
          id: `mem-${memoryEventCounterRef.current}`,
          timestamp: Date.now() / 1000,
          agent: (data.agent as string) || "",
          filePath: (data.file_path as string) || "",
          summary: (data.summary as string) || "",
        };
        setMemoryEvents((prev) => [evt, ...prev]);

        // Track commitments from scribe memory writes
        const agent = (data.agent as string) || "";
        if (agent === "scribe") {
          setLiveCounts((prev) => ({
            ...prev,
            commitmentsTracked: prev.commitmentsTracked + 1,
          }));
        }

        return;
      }

      if (eventType === "draft_section") {
        const rawClaims = data.claims as Array<Record<string, unknown>>;
        const section: DraftSection = {
          sectionName: (data.section_name as string) || "",
          claims: rawClaims.map((c) => ({
            text: (c.text as string) || "",
            citationIds: (c.citation_ids as string[]) || [],
            sourceType: (c.source_type as string) || "",
          })),
          gaps: (data.gaps as string[]) || [],
        };
        setDraftSection(section);
        setRightPanelView({ kind: "draft" });
        return;
      }

      if (eventType === "verified_section") {
        const rawClaims = data.verified_claims as Array<
          Record<string, unknown>
        >;
        const section: VerifiedSection = {
          sectionName: (data.section_name as string) || "",
          summary: (data.summary as string) || "",
          claims: rawClaims.map((c, i) => ({
            id: `vc-${i}`,
            text: (c.text as string) || "",
            tag:
              (c.tag as "verified" | "contested" | "unsupported") || "verified",
            reason: (c.reason as string) || "",
            citationIds: (c.citation_ids as string[]) || [],
            sourceType: (c.source_type as string) || "",
            usedVision: (c.used_vision as boolean) || false,
          })),
        };
        setVerifiedSection(section);

        // Update verification counts per indicator
        const vCounts: Record<
          string,
          { verified: number; unsupported: number; contested: number }
        > = {};
        for (const claim of section.claims) {
          // Use citation source types as proxy for indicator mapping
          for (const citId of claim.citationIds) {
            // Find which indicator this evidence belongs to
            for (const [, imgEvidence] of Object.entries(evidenceByImage)) {
              const match = imgEvidence.items.find((item) => item.id === citId);
              if (match && match.indicator) {
                if (!vCounts[match.indicator]) {
                  vCounts[match.indicator] = {
                    verified: 0,
                    unsupported: 0,
                    contested: 0,
                  };
                }
                vCounts[match.indicator][claim.tag]++;
              }
            }
          }
        }
        setVerificationCounts(vCounts);

        // Update live counters
        setLiveCounts((prev) => ({
          ...prev,
          claimsVerified: section.claims.length,
        }));

        // Don't auto-switch to report view here — choreography handles it
        return;
      }
    },
    [evidenceByImage, runChoreography],
  );

  // ─── SSE connection ───────────────────────────────────────

  function startDemo() {
    setAgents(initialAgentStates());
    setIsRunning(true);
    setIsDone(false);
    setError(null);
    setDocuments(INITIAL_DOCUMENTS);
    setSelectedDocumentId(null);
    setMemoryEvents([]);
    setEvidenceByImage({});
    setEvidenceCounts({});
    setVerificationCounts({});
    setDraftSection(null);
    setVerifiedSection(null);
    setDriftRows([]);
    setRightPanelView({ kind: "empty" });
    setSelectedBoxId(null);
    setSelectedClaimId(null);
    setSelectedIndicatorId(null);
    setLiveCounts({ documentsRead: 0, commitmentsTracked: 0, claimsVerified: 0 });
    setChoreographyPhase("idle");
    setAnimateReportCounters(false);
    setAnimateDrift(false);
    setShowReportCard(false);
    pipelineCompletedRef.current = false;
    memoryEventCounterRef.current = 0;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${BACKEND_URL}/api/demo/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleEvent(data);
      } catch {
        // Ignore unparseable events
      }
    };

    es.onerror = () => {
      if (
        pipelineCompletedRef.current ||
        es.readyState === EventSource.CLOSED
      ) {
        setIsRunning(false);
        es.close();
        return;
      }
      setError("Connection to backend lost. Is the server running?");
      setIsRunning(false);
      es.close();
    };
  }

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // ─── Click handlers ───────────────────────────────────────

  function handleBoxClick(box: BoundingBox) {
    setSelectedBoxId(box.id === selectedBoxId ? null : box.id);
  }

  function handleClaimClick(claim: VerifiedClaim) {
    setSelectedClaimId(claim.id === selectedClaimId ? null : claim.id);

    // If the claim has citations, try to show the evidence image
    if (claim.citationIds.length > 0) {
      for (const [filename, imgEvidence] of Object.entries(evidenceByImage)) {
        const match = imgEvidence.items.find((item) =>
          claim.citationIds.includes(item.id),
        );
        if (match) {
          setRightPanelView({ kind: "evidence", imageFilename: filename });
          if (match.boundingBoxes.length > 0) {
            setSelectedBoxId(match.boundingBoxes[0].id);
          }
          return;
        }
      }
    }
  }

  function handleDocumentClick(doc: DemoDocument) {
    setSelectedDocumentId(doc.id === selectedDocumentId ? null : doc.id);

    // Show the document in the right panel
    if (doc.type === "form") {
      const imgEvidence = evidenceByImage[doc.filename];
      if (imgEvidence) {
        setRightPanelView({ kind: "evidence", imageFilename: doc.filename });
      }
    }
  }

  function handleIndicatorClick(indicatorId: string) {
    setSelectedIndicatorId(
      indicatorId === selectedIndicatorId ? null : indicatorId,
    );
  }

  // ─── Render ───────────────────────────────────────────────

  const hasActivity = isRunning || isDone;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-zinc-100">Poneglyph</h1>
          <span className="text-2xs text-zinc-600">
            Multi-agent institutional memory
          </span>
        </div>

        {/* Live counters — visible during and after a run */}
        {hasActivity && (
          <div className="flex items-center gap-4">
            <span className="font-mono text-2xs text-zinc-500">
              <span className="text-zinc-300">
                {liveCounts.documentsRead}
              </span>{" "}
              documents read
            </span>
            <span className="font-mono text-2xs text-zinc-500">
              <span className="text-zinc-300">
                {liveCounts.commitmentsTracked}
              </span>{" "}
              commitments tracked
            </span>
            <span className="font-mono text-2xs text-zinc-500">
              <span className="text-zinc-300">
                {liveCounts.claimsVerified}
              </span>{" "}
              claims verified
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {isDone && (
            <span className="font-mono text-2xs text-emerald-500">
              Pipeline complete
            </span>
          )}
          {error && (
            <span className="font-mono text-2xs text-red-500">{error}</span>
          )}
          <Button
            onClick={startDemo}
            disabled={isRunning}
            size="sm"
            className="h-7 rounded-md bg-zinc-100 px-3 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
          >
            {isRunning
              ? "Running..."
              : isDone
                ? "Run Again"
                : "Run Canonical Demo"}
          </Button>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel — Logframe Coverage (280px) */}
        <aside className="w-[280px] shrink-0 border-r border-zinc-800">
          <LogframeCoverage
            outputs={LOGFRAME_OUTPUTS}
            evidenceCounts={evidenceCounts}
            verificationCounts={verificationCounts}
            selectedIndicatorId={selectedIndicatorId}
            onIndicatorClick={handleIndicatorClick}
          />
        </aside>

        {/* Center panel — agents + documents */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Agent cards — 2x3 grid */}
          <div className="border-b border-zinc-800 p-4">
            <div className="grid grid-cols-3 gap-3">
              {AGENT_ORDER.map((name) => (
                <AgentCard
                  key={name}
                  label={AGENT_META[name].label}
                  status={agents[name].status}
                  tokensUsed={agents[name].tokensUsed}
                  budgetTotal={agents[name].budgetTotal}
                  currentAction={agents[name].currentAction}
                  resultSummary={agents[name].resultSummary}
                />
              ))}
            </div>
          </div>

          {/* Documents panel — replaces memory feed */}
          <div className="flex min-h-0 flex-1 flex-col">
            <DocumentsPanel
              documents={documents}
              selectedDocumentId={selectedDocumentId}
              onDocumentClick={handleDocumentClick}
            />
          </div>

          {/* Technical view — collapsed memory feed for engineers */}
          {memoryEvents.length > 0 && (
            <div className="border-t border-zinc-800 px-4 py-2">
              <details>
                <summary className="cursor-pointer select-none text-2xs text-zinc-600 hover:text-zinc-500">
                  Show technical view ({memoryEvents.length} memory writes)
                </summary>
                <div className="mt-2 h-32">
                  <MemoryFeed events={memoryEvents} />
                </div>
              </details>
            </div>
          )}
        </main>

        {/* Right panel — output viewer (480px) */}
        <aside className="w-[480px] shrink-0 border-l border-zinc-800">
          {/* Report card slide-up during choreography */}
          {showReportCard && rightPanelView.kind === "report" ? (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`h-full ${
                choreographyPhase === "border-pulse"
                  ? "animate-border-pulse"
                  : ""
              }`}
            >
              <OutputPanel
                view={rightPanelView}
                evidenceByImage={evidenceByImage}
                draftSection={draftSection}
                verifiedSection={verifiedSection}
                selectedBoxId={selectedBoxId}
                selectedClaimId={selectedClaimId}
                onBoxClick={handleBoxClick}
                onClaimClick={handleClaimClick}
                driftRows={driftRows}
                isDone={isDone}
                animateCounters={animateReportCounters}
                animateDrift={animateDrift}
              />
            </motion.div>
          ) : (
            <OutputPanel
              view={rightPanelView}
              evidenceByImage={evidenceByImage}
              draftSection={draftSection}
              verifiedSection={verifiedSection}
              selectedBoxId={selectedBoxId}
              selectedClaimId={selectedClaimId}
              onBoxClick={handleBoxClick}
              onClaimClick={handleClaimClick}
              driftRows={driftRows}
              isDone={isDone}
              animateCounters={animateReportCounters}
              animateDrift={animateDrift}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Build DriftRow data from contradiction events.
 *
 * The orchestrator may include contradiction data in the done event.
 * Each contradiction has: topic, meetings involved, values at each
 * meeting, and severity. We group by topic into rows.
 */
function buildDriftRows(
  contradictions: Array<Record<string, unknown>>,
): DriftRow[] {
  const rowMap = new Map<string, DriftRow>();

  for (const c of contradictions) {
    const topic = (c.topic as string) || (c.description as string) || "Unknown";
    const severity = (c.severity as "low" | "medium" | "high") || "medium";
    const meeting1 = (c.meeting_1 as string) || "Meeting 1";
    const meeting2 = (c.meeting_2 as string) || "Meeting 2";
    const value1 = (c.value_1 as string) || (c.original as string) || "";
    const value2 = (c.value_2 as string) || (c.changed_to as string) || "";
    const description =
      (c.description as string) || `${value1} → ${value2}`;

    if (!rowMap.has(topic)) {
      rowMap.set(topic, {
        topic: topic.length > 20 ? topic.slice(0, 20) + "..." : topic,
        nodes: [
          { meetingLabel: meeting1, value: value1 },
          { meetingLabel: meeting2, value: value2 },
        ],
        bends: [
          {
            afterNodeIndex: 0,
            delta: `${value1} → ${value2}`,
            severity,
            description,
          },
        ],
      });
    }
  }

  return Array.from(rowMap.values());
}
