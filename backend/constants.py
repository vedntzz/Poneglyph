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
# Tuned from observed usage in live demo runs (2026-04-24):
#   Scout: ~10k observed → 20k ceiling (single-call, images add tokens)
#   Scribe: ~8k observed → 15k ceiling (single-call, text only)
#   Archivist: ~42k observed → 60k ceiling (multi-round agentic loop)
#   Drafter: ~33k observed → 50k ceiling (multi-round reading + generation)
#   Auditor: ~83k observed → 120k ceiling (two-phase: vision + adversarial loop)
AGENT_BUDGETS: dict[str, int] = {
    "scout": 20_000,
    "scribe": 15_000,
    "archivist": 60_000,
    "drafter": 50_000,
    "auditor": 120_000,
}
