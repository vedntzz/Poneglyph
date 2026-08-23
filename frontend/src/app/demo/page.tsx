"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/agent-card";
import { MemoryFeed, type MemoryEvent } from "@/components/memory-feed";
import { ImageWithBoxes, type BoundingBox } from "@/components/image-with-boxes";
import {
  VerifiedReportViewer,
  type VerifiedClaim,
} from "@/components/verified-report-viewer";

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
  | { kind: "report" };

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

/** Logframe indicators — fixed for the mp-fpc-2024 demo project. */
const LOGFRAME_OUTPUTS = [
  {
    id: "Output 1",
    name: "Farmer Producer Companies Established",
    indicators: [
      { id: "1.1", name: "FPCs registered", target: "15 FPCs" },
      { id: "1.2", name: "Farmers enrolled", target: "10,000 farmers" },
      { id: "1.3", name: "Women farmer participation", target: "30%" },
    ],
  },
  {
    id: "Output 2",
    name: "Infrastructure Development",
    indicators: [
      { id: "2.1", name: "Cold storage facilities", target: "5 facilities" },
      { id: "2.2", name: "Sale points operational", target: "20 sale points" },
    ],
  },
  {
    id: "Output 3",
    name: "Capacity Building",
    indicators: [
      { id: "3.1", name: "PHM trainings conducted", target: "50 trainings" },
      { id: "3.2", name: "Women's PHM trainings", target: "20 trainings" },
      { id: "3.3", name: "Stakeholders trained", target: "1,000 people" },
    ],
  },
];

// Image dimensions (all synthetic forms are 1500x2000)
const IMAGE_WIDTH = 1500;
const IMAGE_HEIGHT = 2000;

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
// Left panel: project binder
// ─────────────────────────────────────────────────────────────

function LogframePanel({
  evidenceCounts,
}: {
  evidenceCounts: Record<string, number>;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Project Binder
        </h2>
        <p className="mt-0.5 font-mono text-2xs text-zinc-600">mp-fpc-2024</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {LOGFRAME_OUTPUTS.map((output) => (
          <div key={output.id} className="mb-4">
            <p className="px-2 text-2xs font-medium uppercase tracking-wider text-zinc-500">
              {output.id}
            </p>
            <p className="mb-1.5 px-2 text-2xs text-zinc-600">
              {output.name}
            </p>
            {output.indicators.map((ind) => {
              const count = evidenceCounts[`Output ${ind.id}`] ?? 0;
              return (
                <div
                  key={ind.id}
                  className="flex items-center justify-between rounded-sm px-2 py-1 hover:bg-zinc-900/50"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-2xs text-zinc-500">
                      {ind.id}
                    </span>
                    <span className="ml-2 text-2xs text-zinc-400">
                      {ind.name}
                    </span>
                  </div>
                  {count > 0 && (
                    <span className="ml-2 shrink-0 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 font-mono text-2xs text-emerald-400">
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
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
}: {
  view: RightPanelView;
  evidenceByImage: Record<string, ImageEvidence>;
  draftSection: DraftSection | null;
  verifiedSection: VerifiedSection | null;
  selectedBoxId: string | null;
  selectedClaimId: string | null;
  onBoxClick: (box: BoundingBox) => void;
  onClaimClick: (claim: VerifiedClaim) => void;
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
          <h2 className="text-xs font-medium text-zinc-300">
            Draft Report
          </h2>
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
                  {claim.text}
                  <span className="ml-1.5 inline-flex items-center rounded-sm border border-zinc-700 bg-zinc-800/50 px-1 py-0.5 font-mono text-2xs text-zinc-500">
                    {claim.citationIds.length} cite{claim.citationIds.length !== 1 ? "s" : ""}
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
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-xs font-medium text-zinc-300">
            Verified Report
          </h2>
          <p className="font-mono text-2xs text-zinc-600">
            World Bank ISR format
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <VerifiedReportViewer
            sectionName={verifiedSection.sectionName}
            claims={verifiedSection.claims}
            onClaimClick={onClaimClick}
            selectedClaimId={selectedClaimId}
          />
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

  // Memory feed
  const [memoryEvents, setMemoryEvents] = useState<MemoryEvent[]>([]);

  // Evidence data from Scout
  const [evidenceByImage, setEvidenceByImage] = useState<
    Record<string, ImageEvidence>
  >({});
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>(
    {},
  );

  // Draft section from Drafter (pre-verification)
  const [draftSection, setDraftSection] = useState<DraftSection | null>(null);

  // Verified report from Auditor
  const [verifiedSection, setVerifiedSection] =
    useState<VerifiedSection | null>(null);

  // Right panel state
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>({
    kind: "empty",
  });
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pipelineCompletedRef = useRef(false);
  const memoryEventCounterRef = useRef(0);

  // ─── Event handlers ───────────────────────────────────────

  const handleEvent = useCallback(
    (data: Record<string, unknown>) => {
      const eventType = data.type as string;

      if (eventType === "done") {
        pipelineCompletedRef.current = true;
        setIsRunning(false);
        setIsDone(true);
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
            confidence: (item.confidence as "HIGH" | "MEDIUM" | "LOW") || "HIGH",
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
              confidence: (item.confidence as "HIGH" | "MEDIUM" | "LOW") || "HIGH",
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
            tag: (c.tag as "verified" | "contested" | "unsupported") || "verified",
            reason: (c.reason as string) || "",
            citationIds: (c.citation_ids as string[]) || [],
            sourceType: (c.source_type as string) || "",
            usedVision: (c.used_vision as boolean) || false,
          })),
        };
        setVerifiedSection(section);
        setRightPanelView({ kind: "report" });
        return;
      }
    },
    [],
  );

  // ─── SSE connection ───────────────────────────────────────

  function startDemo() {
    setAgents(initialAgentStates());
    setIsRunning(true);
    setIsDone(false);
    setError(null);
    setMemoryEvents([]);
    setEvidenceByImage({});
    setEvidenceCounts({});
    setDraftSection(null);
    setVerifiedSection(null);
    setRightPanelView({ kind: "empty" });
    setSelectedBoxId(null);
    setSelectedClaimId(null);
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
      // Find which image has this evidence
      for (const [filename, imgEvidence] of Object.entries(evidenceByImage)) {
        const match = imgEvidence.items.find((item) =>
          claim.citationIds.includes(item.id),
        );
        if (match) {
          setRightPanelView({ kind: "evidence", imageFilename: filename });
          // Select the first bounding box of the matched evidence
          if (match.boundingBoxes.length > 0) {
            setSelectedBoxId(match.boundingBoxes[0].id);
          }
          return;
        }
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────

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

        <div className="flex items-center gap-3">
          {isDone && (
            <span className="font-mono text-2xs text-emerald-500">
              Pipeline complete
            </span>
          )}
          {error && (
            <span className="font-mono text-2xs text-red-500">
              {error}
            </span>
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
        {/* Left panel — project binder (280px) */}
        <aside className="w-[280px] shrink-0 border-r border-zinc-800">
          <LogframePanel evidenceCounts={evidenceCounts} />
        </aside>

        {/* Center panel — agents + memory feed */}
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

          {/* Memory feed */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-zinc-800 px-4 py-2">
              <h2 className="text-2xs font-medium uppercase tracking-wider text-zinc-500">
                Memory Feed
              </h2>
            </div>
            <div className="min-h-0 flex-1 px-2 py-1">
              <MemoryFeed events={memoryEvents} />
            </div>
          </div>
        </main>

        {/* Right panel — output viewer (480px) */}
        <aside className="w-[480px] shrink-0 border-l border-zinc-800">
          <OutputPanel
            view={rightPanelView}
            evidenceByImage={evidenceByImage}
            draftSection={draftSection}
            verifiedSection={verifiedSection}
            selectedBoxId={selectedBoxId}
            selectedClaimId={selectedClaimId}
            onBoxClick={handleBoxClick}
            onClaimClick={handleClaimClick}
          />
        </aside>
      </div>
    </div>
  );
}
