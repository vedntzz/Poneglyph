"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ─────────────────────────────────────────────────────────────
// Types — mirrors the backend ProgressEvent
// ─────────────────────────────────────────────────────────────

interface AgentState {
  status: "pending" | "starting" | "running" | "done" | "error";
  currentAction: string;
  tokensUsed: number;
  budgetTotal: number;
  budgetRemaining: number;
  resultSummary: string;
}

/** The 6 agents in pipeline order. */
const AGENT_ORDER = [
  "scout",
  "scribe",
  "archivist",
  "drafter",
  "auditor",
  "orchestrator",
] as const;

type AgentName = (typeof AGENT_ORDER)[number];

/** Display metadata for each agent. */
const AGENT_META: Record<
  AgentName,
  { label: string; description: string; budget: number }
> = {
  scout: {
    label: "Scout",
    description: "Extracts evidence from scanned documents with pixel-coordinate vision",
    budget: 20_000,
  },
  scribe: {
    label: "Scribe",
    description: "Processes meeting transcripts into structured minutes",
    budget: 15_000,
  },
  archivist: {
    label: "Archivist",
    description: "Answers queries by reading the project binder on demand",
    budget: 60_000,
  },
  drafter: {
    label: "Drafter",
    description: "Writes donor-format report sections with source citations",
    budget: 50_000,
  },
  auditor: {
    label: "Auditor",
    description: "Adversarially verifies every claim against cited sources",
    budget: 120_000,
  },
  orchestrator: {
    label: "Orchestrator",
    description: "Coordinates the agent pipeline",
    budget: 0,
  },
};

function initialAgentStates(): Record<AgentName, AgentState> {
  const states: Partial<Record<AgentName, AgentState>> = {};
  for (const name of AGENT_ORDER) {
    states[name] = {
      status: "pending",
      currentAction: "",
      tokensUsed: 0,
      budgetTotal: AGENT_META[name].budget,
      budgetRemaining: AGENT_META[name].budget,
      resultSummary: "",
    };
  }
  return states as Record<AgentName, AgentState>;
}

// ─────────────────────────────────────────────────────────────
// Agent card component
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AgentState["status"] }) {
  const variants: Record<
    AgentState["status"],
    { label: string; className: string }
  > = {
    pending: {
      label: "Pending",
      className: "bg-muted text-muted-foreground border-muted",
    },
    starting: {
      label: "Starting",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    },
    running: {
      label: "Running",
      className: "bg-amber-100 text-amber-800 border-amber-200 animate-pulse",
    },
    done: {
      label: "Done",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    error: {
      label: "Error",
      className: "bg-red-100 text-red-800 border-red-200",
    },
  };

  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}

function AgentCard({
  name,
  state,
}: {
  name: AgentName;
  state: AgentState;
}) {
  const meta = AGENT_META[name];
  const hasBudget = meta.budget > 0;
  const usedPercent = hasBudget
    ? (state.tokensUsed / meta.budget) * 100
    : 0;
  const isOverBudget = hasBudget && state.tokensUsed > meta.budget;

  // Color the progress bar based on consumption
  let barColor = "bg-emerald-500";
  if (isOverBudget || usedPercent > 75) barColor = "bg-red-500";
  else if (usedPercent > 50) barColor = "bg-amber-500";

  // Show "Over budget" badge when done but exceeded ceiling
  const showOverBudget = isOverBudget && state.status === "done";

  return (
    <Card
      className={
        state.status === "running"
          ? "border-amber-300 shadow-md transition-all duration-300"
          : state.status === "done" && !showOverBudget
          ? "border-emerald-300 transition-all duration-300"
          : state.status === "done" && showOverBudget
          ? "border-amber-300 transition-all duration-300"
          : state.status === "error"
          ? "border-red-300 transition-all duration-300"
          : "transition-all duration-300"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{meta.label}</CardTitle>
          {showOverBudget ? (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
              Over budget
            </Badge>
          ) : (
            <StatusBadge status={state.status} />
          )}
        </div>
        <CardDescription className="text-xs">
          {meta.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current action */}
        <div className="min-h-[1.25rem]">
          {state.currentAction && (
            <p className="text-sm text-muted-foreground truncate">
              {state.currentAction}
            </p>
          )}
        </div>

        {/* Token budget bar — only for agents with budgets */}
        {hasBudget && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {state.tokensUsed.toLocaleString()} /{" "}
                {meta.budget.toLocaleString()} tokens
              </span>
              <span>{Math.round(usedPercent)}% used</span>
            </div>
            <Progress
              value={usedPercent}
              indicatorClassName={barColor}
            />
          </div>
        )}

        {/* Result summary — shown when done */}
        {state.resultSummary && (
          <p className="text-sm font-medium">
            {state.resultSummary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Main demo page
// ─────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [agents, setAgents] = useState(initialAgentStates);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  // Track whether the pipeline completed so we can suppress the
  // spurious "connection lost" error when the SSE stream closes normally.
  const pipelineCompletedRef = useRef(false);

  const handleEvent = useCallback(
    (data: Record<string, unknown>) => {
      if (data.type === "done") {
        pipelineCompletedRef.current = true;
        setIsRunning(false);
        setIsDone(true);
        return;
      }

      if (data.type === "progress") {
        const agentName = data.agent_name as AgentName;
        if (!AGENT_ORDER.includes(agentName)) return;

        setAgents((prev) => ({
          ...prev,
          [agentName]: {
            status: data.status as AgentState["status"],
            currentAction: (data.current_action as string) || "",
            tokensUsed: (data.tokens_used as number) || 0,
            budgetTotal: (data.budget_total as number) || 0,
            budgetRemaining: (data.budget_remaining as number) || 0,
            resultSummary: (data.result_summary as string) || "",
          },
        }));
      }
    },
    []
  );

  function startDemo() {
    // Reset state
    setAgents(initialAgentStates());
    setIsRunning(true);
    setIsDone(false);
    setError(null);
    pipelineCompletedRef.current = false;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Canonical demo endpoint: resets the project and runs all 5 agents
    // on fixed synthetic inputs. See /backend/main.py GET /api/demo/stream.
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
      // EventSource fires onerror when the stream closes — even after
      // a normal "done" event. Suppress the false alarm if the pipeline
      // already completed successfully.
      if (pipelineCompletedRef.current || es.readyState === EventSource.CLOSED) {
        setIsRunning(false);
        es.close();
        return;
      }
      setError("Connection to backend lost. Is the server running?");
      setIsRunning(false);
      es.close();
    };
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Poneglyph
          </h1>
          <p className="text-muted-foreground">
            Multi-agent institutional memory for development projects.
            Live token accounting across the pipeline.
          </p>
        </div>

        {/* Control bar */}
        <div className="flex items-center gap-4">
          <Button
            onClick={startDemo}
            disabled={isRunning}
            size="lg"
          >
            {isRunning
              ? "Running..."
              : isDone
              ? "Run Again"
              : "Run Canonical Demo"}
          </Button>

          {isDone && (
            <span className="text-sm text-emerald-600 font-medium">
              Pipeline complete
            </span>
          )}

          {!isRunning && !isDone && (
            <span className="text-sm text-muted-foreground">
              3 scanned forms + 2 meeting transcripts — resets project each run
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Agent grid — 3 columns on desktop, 1 on mobile */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AGENT_ORDER.map((name) => (
            <AgentCard
              key={name}
              name={name}
              state={agents[name]}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
