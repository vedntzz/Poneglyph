# Session 006: Orchestrator + Task Budget UI

**Date:** 2026-04-24
**Claude Code model:** claude-opus-4-7

---

## Definition of Ready

**Scope (in):**
- Create `/backend/orchestrator.py` with class `Orchestrator`
  - Plain Python controller (NOT an LLM call) — sequences agents
  - `run_ingestion(project_id, image_paths, transcript_paths)` — Scout on images, Scribe on transcripts
  - `run_query(project_id, query)` — delegates to Archivist
  - `run_report_section(project_id, section_name, donor_format)` — Drafter → Auditor pipeline
  - `run_full_demo(project_id)` — canonical demo flow end-to-end
  - Task budgets per agent: Scout 25k, Scribe 25k, Archivist 40k, Drafter 50k, Auditor 60k
  - Streams progress events via callback: agent_name, status, tokens_used, budget_remaining, current_action
- SSE streaming endpoint: `GET /api/orchestrator/stream` — emits progress events in real time
- Frontend `/demo` page with 6 agent cards showing live status + token budget bars
- Session log

**Scope (out):**
- Deterministic demo inputs (Session 007)
- Full production UI polish (Session 008)
- Video recording

**Context loaded:**
- CLAUDE.md, sessions 001–005
- All 5 agent implementations + ProjectMemory
- main.py (9 existing endpoints)
- Frontend: Next.js 14, shadcn Card/Button/Input/Textarea, Tailwind v3

**Context budget:** ~100k tokens

**Acceptance criteria:**
1. Orchestrator.run_full_demo() completes without errors on test data
2. SSE endpoint streams progress events consumed by frontend
3. /demo page shows live agent cards updating as orchestrator runs
4. Task budget bars visibly count down (the money shot)
5. Task budgets passed as beta headers on API calls
6. Demo flow matches CLAUDE.md canonical flow
7. Session log complete

**Design decisions:**
- Task budget: `anthropic-beta: task-budgets-2026-03-13` header + `task_budget` in request body
- SSE via raw `StreamingResponse` (no extra dependency — Rule 6: dependencies are debt)
- Orchestrator emits events on tight cadence: agent_start, periodic heartbeats, agent_done
- Token tracking via `response.usage` accumulation per agent

---

## Standup

- **Last session (005):** Built Drafter (donor-format reports with atomic claims) and Auditor (adversarial self-verification with ✓/⚠/✗ tags). Post-session: added AUDITOR_ALWAYS_VISION_CHECK flag for demo capability surfacing.
- **This session:** Build the Orchestrator controller + SSE streaming + frontend demo page. This is where the task budget UI — a 4.7-specific feature nobody has shipped yet — becomes visible.

---

## Work Log

- **[start]** — Read CLAUDE.md, sessions 001–005, all agent code. Full context loaded.
- **[session-log]** — Wrote Definition of Ready.
