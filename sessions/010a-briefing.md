# Session 010A: Briefing Agent — Pre-Meeting Preparation with Grounded Recommendations

**Date:** 2026-04-25
**Claude Code model:** claude-opus-4-6

---

## Definition of Ready

**Scope (in):**
- New agent: `BriefingAgent` at `/backend/agents/briefing.py`
  - Takes: project_id, stakeholder, optional meeting_context
  - Returns: `Briefing` (project_summary, 3 push_for, 3 push_back_on_us, 2 do_not_bring_up, closing_note)
  - Agentic tool-use loop (Archivist pattern) for reading memory
  - Forced tool_choice for structured output (Drafter pattern)
  - Every recommendation cites specific IDs from the project binder
- System prompt at `/prompts/briefing.md` with HTML comments
- Endpoint: `POST /api/briefing/generate`
- Test file: `/backend/agents/test_briefing.py`
- Variance test: 3 runs, AgriMart drift in push_back_on_us 2/3+ runs
- This session log

**Scope (out):**
- UI changes (Session 010B)
- Deployment
- Modifying existing agents
- Streaming briefing token-by-token

**Context loaded:**
- CLAUDE.md, sessions 004 (Archivist pattern), 005 (Drafter pattern), 006 (orchestrator), 008.5 (UI state)
- EVALS.md, FAILURE_MODES.md
- Full Archivist + Drafter agent code (patterns to follow)
- Existing prompts (archivist.md, drafter.md)
- test_archivist.py (test pattern to follow)

**Context budget:** ~80k tokens

**Acceptance criteria:**
1. `python -m agents.test_briefing` passes
2. Variance: 3 runs, AgriMart drift surfaces in 2+ runs
3. Generated briefing contains specific citations (cmt-*, mtg-*, ev-*)
4. System prompt at prompts/briefing.md with HTML comments
5. Endpoint returns valid Briefing JSON
6. Session log complete with sample output and variance documentation

---

## Standup

- **Last session (009 + 008.5 fixes):** Built eval framework (28 test cases, 89% overall). UX overhaul shipped 7 new components. Fixed 7 SSE wiring bugs.
- **This session:** Build the Briefing agent — the first genuinely action-shaped output. Everything else Poneglyph produces is observational (evidence, reports, contradictions). The briefing is the PM's prep sheet for their next meeting.

---

## Work Log

- **[start]** — Read CLAUDE.md, sessions 004/005/006/008.5, EVALS.md, FAILURE_MODES.md. Read full Archivist and Drafter agent code + prompts. Understood both patterns: Archivist's agentic tool-use loop for memory reading, Drafter's forced tool_choice for structured output.
- **[session-log]** — Wrote Definition of Ready.
- **[prompt]** — Wrote `prompts/briefing.md`: 7 rules with HTML comments. Key design choices:
  - Rule 1: Read binder before writing — same as Archivist principle
  - Rule 2: Every recommendation cites specific IDs — this is what separates Poneglyph from ChatGPT
  - Rule 4: Think like adversarial stakeholder for push_back — the most valuable section
  - Rule 6: Be action-shaped not status-shaped — the whole point of Briefing vs Drafter
  - Rule 7: Use generate_briefing tool for structured output
- **[agent]** — Wrote `backend/agents/briefing.py` (636 lines):
  - Pydantic models: `BriefingItem(text, citations, rationale)`, `Briefing(stakeholder, meeting_context, project_summary, push_for[3], push_back_on_us[3], do_not_bring_up[2], closing_note)`
  - 8 memory-reading tools (list_evidence, list_meetings, list_commitments, read_evidence_file, read_meeting_file, read_commitment_file, read_logframe, read_timeline) + generate_briefing output tool
  - Agentic loop (MAX_TOOL_ROUNDS=8): model reads binder on demand, calls generate_briefing when ready
  - Conversation building preserving thinking blocks (signature field)
  - Adaptive thinking at default effort level
  - Token tracking via total_tokens_used
- **[endpoint]** — Added `POST /api/briefing/generate` to `backend/main.py`:
  - BriefingRequest, BriefingItemResponse, BriefingResponse models
  - Project existence check, APIError/ValueError handling
  - Placed before canonical demo endpoints section
- **[test]** — Wrote `backend/agents/test_briefing.py`:
  - Populates memory via ScribeAgent with meeting_001.txt + meeting_002.txt
  - Generates briefing for stakeholder="World Bank", meeting_context="Quarterly progress review — Q1 FY2026"
  - Assertions: exactly 3/3/2 structure, every item has >= 1 citation, closing note not generic
  - AgriMart drift detection via keyword matching + "50"/"42" number check
- **[variance]** — Ran 3 variance tests. All 3 passed. See results below.

---

## Variance Results

### Run Summary

| Run | Tokens | AgriMart Drift | Structure | Citations |
|-----|--------|---------------|-----------|-----------|
| 1   | 27,296 | DETECTED      | 3/3/2     | All items |
| 2   | 30,239 | DETECTED      | 3/3/2     | All items |
| 3   | 31,041 | DETECTED      | 3/3/2     | All items |

**AgriMart drift: 3/3 runs (100%)** — target was 2/3+.

### What's Stable (all 3 runs)

- **AgriMart drift in push_back_on_us**: always detected — the 50→42 walk-back is the strongest signal in the binder
- **Women's PHM training in push_for**: always appears as a push_for item — strong evidence in the binder
- **Rehli cold storage**: always mentioned somewhere in the briefing
- **Structure**: always exactly 3 push_for, 3 push_back_on_us, 2 do_not_bring_up
- **Citations**: every item has at least 1 citation
- **Closing note**: always specific to the project, never generic

### What Varies

- **Specific commitment IDs**: Scribe generates non-deterministic IDs per run, so cmt-* values differ
- **Exact wording**: recommendations are phrased differently across runs
- **Item ranking**: which item is #1 vs #2 vs #3 varies
- **Token count**: 27k-31k range (13% variance)
- **Number of commitments in memory**: Run 1 had 6, Runs 2-3 had 12 (Scribe non-determinism)

### Sample Briefing Output (Run 1)

```
BRIEFING FOR World Bank

Project Summary:
  The MP-FPC project has completed its kickoff phase and first
  quarterly review, with demonstrable progress across multiple
  outputs...

PUSH FOR (3 items):
  1. Women's PHM training — Gumla pilot data shows strong early results
     Citations: [cmt-*, mtg-*]
  2. FarmTrac registration — momentum is real and citable
     Citations: [ev-*, cmt-*]
  3. Cold storage facility at Rehli — on track, push for timeline commitment
     Citations: [cmt-*]

PUSH BACK ON US (3 items):
  1. AgriMart target drift — originally 50, now only 42 in pipeline
     Citations: [mtg-*, cmt-*]
  2. Evidence gaps in some output areas
     Citations: [ev-*]
  3. Timeline slippage on quarterly milestones
     Citations: [mtg-*]

DO NOT BRING UP (2 items):
  1. Internal disagreements on target revisions
     Citations: [mtg-*]
  2. Incomplete evidence chain for certain indicators
     Citations: [ev-*]

Closing Note:
  The biggest risk is the AgriMart shortfall becoming a formal
  finding...
```

*(Exact IDs redacted — they change per Scribe run. Full raw output available in test console logs.)*

---

## Context Budget

| Phase | Tokens | Notes |
|-------|--------|-------|
| Prompt + agent code writing | ~5k | Local, no API calls |
| Variance Run 1 | 27,296 | Includes Scribe (2 meetings) + Briefing |
| Variance Run 2 | 30,239 | Same |
| Variance Run 3 | 31,041 | Same |
| **Total API tokens** | **~88,576** | Across all 3 runs |

---

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `python -m agents.test_briefing` passes | PASS |
| 2 | Variance: AgriMart drift in 2/3+ runs | PASS (3/3) |
| 3 | Briefing contains specific citations | PASS |
| 4 | System prompt at prompts/briefing.md with HTML comments | PASS |
| 5 | Endpoint returns valid Briefing JSON | PASS |
| 6 | Session log complete with variance documentation | PASS |

---

## Retro

### What worked

- **Pattern reuse from Archivist + Drafter**: The agentic tool-use loop was the right call. The Briefing agent reads memory on demand, which means it works with any project state — not just the synthetic test data. Zero new patterns needed.
- **User message nudge for contradictions**: Adding "pay special attention to contradictions" to the user message got AgriMart drift detection to 3/3. Without it, the model sometimes missed the silent walk-back because it's implicit (42 mentioned without revising the 50 target).
- **Clean Pydantic models**: The BriefingItem/Briefing models made the test assertions trivial and the endpoint serialization automatic.
- **636 lines for the whole agent**: Simple enough for a judge to read in one sitting. No abstraction layers, no base classes, no mixins.

### What didn't work

- **First run token variance**: Run 1 produced 6 commitments in memory vs 12 in Runs 2-3. This is Scribe non-determinism, not a Briefing bug. Documented in FAILURE_MODES.md.
- **No streaming**: The briefing takes 15-30 seconds to generate. The endpoint is synchronous. Session 010B should consider a loading state.

### What to change for next session

- **Session 010B (homepage)**: The homepage should use the briefing as its primary action. The endpoint is ready. Need a loading state since generation is not instant.
- **Consider caching**: If the same project/stakeholder combo is requested multiple times, we could cache the briefing for a short TTL. Not needed for the hackathon demo.
