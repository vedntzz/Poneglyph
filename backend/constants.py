"""Shared constants for Poneglyph agents — per-agent token budgets.

Per-agent token budgets (client-side ceilings, surfaced live in UI).
These represent how many tokens we're willing to spend per agent call.
The Orchestrator tracks actual consumption via response.usage and emits
real numbers to the frontend via SSE — the budget bars show honest spend.

Previously intended to use Opus 4.7's task_budget beta parameter
(header task-budgets-2026-03-13) so the model could self-prioritize
within a visible countdown. That feature is not yet available on the
public Messages API as of 2026-04-24 — the SDK defines
BetaTokenTaskBudgetParam but messages.create() rejects task_budget with
"Extra inputs are not permitted". If/when it ships, re-enable via the
extra_body/extra_headers pattern. See sessions/006-orchestrator.md.
"""

from __future__ import annotations

# Per-agent token budgets (client-side ceilings).
# Values tuned by agent complexity and typical workload.
# Scout/Scribe: single-call extraction tasks.
# Archivist: multi-round agentic tool-use loop.
# Drafter: multi-round reading + long report generation.
# Auditor: most expensive — vision re-verification + adversarial loop.
AGENT_BUDGETS: dict[str, int] = {
    "scout": 25_000,
    "scribe": 25_000,
    "archivist": 40_000,
    "drafter": 50_000,
    "auditor": 60_000,
}
