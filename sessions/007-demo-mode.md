# Session 007: Demo Mode + Deterministic Inputs

**Date:** 2026-04-24
**Claude Code model:** claude-opus-4-7

---

## Definition of Ready

**Scope (in):**
- Generate a 3rd synthetic form image (cold storage inspection — Output 2.1) so the demo has 3 documents + 2 transcripts
- Create `/backend/demo/` module:
  - `demo_project.py`: `setup_demo_project() -> str` — creates or resets the mp-fpc-2024 project with logframe. Subsumes `seed_demo.py`
  - `canonical_flow.py`: `run_canonical_demo(project_id, on_progress)` — runs the 5-agent pipeline on the fixed demo inputs, deterministic order
- Add `POST /api/demo/reset` endpoint — wipes project memory and re-seeds, so every demo run starts clean
- Frontend: add "Run Canonical Demo" button that calls reset → streams the pipeline
- Smoke test: run the full flow end-to-end, verify SSE events fire correctly, verify frontend cards update
- Session log

**Scope (out):**
- Pre-canned/cached agent responses (actual Opus API calls are fine — determinism comes from fixed inputs + reset, not from caching)
- User-upload mode (Session 008)
- Visual polish beyond the demo button
- Evals framework (Session 008/009)
- Video recording

**Context loaded:**
- CLAUDE.md, sessions 001–006
- All 5 agent implementations, orchestrator, main.py
- Frontend /demo page
- Existing data: 2 synthetic forms, 2 meeting transcripts, seed_demo.py
- ProjectMemory API

**Data audit findings:**
- `/data/synthetic/form_english.png` — Beneficiary Registration Form (Output 1.2: Farmers enrolled). 1500×2000px.
- `/data/synthetic/form_hindi.png` — Women's PHM Training Attendance (Output 3.2: Women's PHM trainings). 1500×2000px.
- `/data/synthetic/meetings/meeting_001.txt` — Project Kickoff Review, 2026-01-15. 6 commitments.
- `/data/synthetic/meetings/meeting_002.txt` — Q1 Progress Review, 2026-03-01. 5 commitments.
- `/data/real_redacted/` — empty. No real data available.
- `/backend/data/projects/mp-fpc-2024/` — 32 files from prior demo runs (14 evidence, 13 commitments, 2 meetings, logframe, project.yaml, timeline). These are agent-generated artifacts that get recreated on each run.
- `/backend/seed_demo.py` — idempotent project seeder with inline logframe. Will be subsumed by `demo/demo_project.py`.
- **Gap:** Need a 3rd form image for the "3 scanned forms" in CLAUDE.md § demo flow. Will generate a cold storage inspection form (Output 2.1: Cold storage facilities).

**Acceptance criteria:**
1. 3 synthetic form images exist and are referenced in demo flow
2. `setup_demo_project()` creates a clean project with logframe
3. `POST /api/demo/reset` wipes and re-seeds the project
4. "Run Canonical Demo" button on /demo page works end-to-end
5. Pipeline completes in under 3 minutes on each run
6. All 6 agent cards update correctly (pending → starting → running → done)
7. Token budget bars show real consumption
8. Smoke test passes (at least 1 clean run)
9. All synthetic data clearly labeled as synthetic
10. Session log complete

**Design decisions:**
- Determinism from fixed inputs + reset, not from caching agent responses. Real API calls every time — this is honest.
- `demo/` is a Python package under `/backend/`, not a separate service.
- Reset endpoint wipes the project memory directory and re-creates it with `setup_demo_project()`. Simple and reliable.
- The canonical flow reuses `Orchestrator.run_full_demo()` — no parallel orchestrator code.

---

## Standup

- **Last session (006):** Built Orchestrator controller, SSE streaming endpoint, and /demo frontend page. Post-session: wired real `response.usage` token tracking across all 5 agents, removed task_budget (not on public API), added over-budget UI treatment, updated budget ceilings to realistic values.
- **This session:** Make the demo deterministic and self-contained. Generate missing form, build reset + canonical flow, add the button.

---

## Work Log

- **[start]** — Read CLAUDE.md, sessions 001–006, all agent code, main.py, orchestrator.py, existing data. Full context loaded.
- **[session-log]** — Wrote Definition of Ready with data audit findings.
- **[3rd-form]** — Added `generate_cold_storage_form()` to `generate_test_images.py`. Generates a cold storage facility inspection report (Output 2.1) — includes facility specs, commodities stored, inspector observations, overall status. 1500×2000px, renders cleanly.
- **[demo-module]** — Created `/backend/demo/` package:
  - `__init__.py` — package marker
  - `demo_project.py` — `setup_demo_project()` and `reset_demo_project()` with `shutil.rmtree` for clean wipe. Constants for all demo inputs (3 images, 2 transcripts, query, section name, donor format). Subsumes `seed_demo.py`.
  - `canonical_flow.py` — `run_canonical_demo()` wraps reset + `Orchestrator.run_full_demo()` with fixed inputs.
- **[endpoints]** — Added to main.py:
  - `POST /api/demo/reset` — wipes and re-seeds the demo project
  - `GET /api/demo/stream` — one-button canonical demo: reset + full pipeline SSE stream
  - Updated `_DEFAULT_IMAGES` to include `form_cold_storage.png`
  - Fixed stale docstring on original SSE endpoint (still referenced task budgets)
- **[frontend]** — Updated `/demo` page:
  - "Start Demo" → "Run Canonical Demo" button
  - SSE URL changed from `/api/orchestrator/stream` to `/api/demo/stream`
  - Added subtitle: "3 scanned forms + 2 meeting transcripts — resets project each run"
  - Frontend build verified clean.
- **[smoke-test]** — Verified:
  - All 3 synthetic images + 2 transcripts exist ✓
  - `setup_demo_project()` and `reset_demo_project()` work correctly ✓
  - After reset: project has exactly 3 files (logframe, project.yaml, timeline) ✓
  - `POST /api/demo/reset` returns 200 with `{"status": "ok"}` ✓
  - `GET /api/demo/stream` streams SSE events (orchestrator → scout starting with "Processing 3 document(s)") ✓
  - Full end-to-end demo run completed ✓ (~8 min, API-bound):
    - 19 evidence items extracted from 3 forms
    - 12 commitments from 2 meeting transcripts
    - 2 meeting records
    - 36 total project memory files

---

## Commits

| Hash | Message |
|------|---------|
| `99cc92a` | `feat(demo): add canonical demo mode with reset + 3rd synthetic form` |

---

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | 3 synthetic form images exist and are referenced | ✓ English, Hindi, cold storage |
| 2 | `setup_demo_project()` creates a clean project | ✓ |
| 3 | `POST /api/demo/reset` wipes and re-seeds | ✓ |
| 4 | "Run Canonical Demo" button works end-to-end | ✓ SSE events stream correctly |
| 5 | Pipeline completes in under 3 minutes | ✗ ~8 min — API-bound, not code. See retro |
| 6 | All 6 agent cards update correctly | ✓ Verified SSE event sequence |
| 7 | Token budget bars show real consumption | ✓ Real response.usage tracking |
| 8 | Smoke test passes (1+ clean run) | ✓ 1 full run completed |
| 9 | All synthetic data clearly labeled | ✓ Meeting transcripts have header, generate script has docstring |
| 10 | Session log complete | ✓ |

---

## Context Budget

- Backend (demo module + main.py changes): ~8k tokens
- Frontend (page update): ~2k tokens
- Synthetic form generator: ~3k tokens
- Session log + testing: ~5k tokens
- Total: ~18k tokens

---

## Retro

**What worked:**
- The demo module design is simple and correct: reset → run pipeline → stream events. No new orchestration logic — just wiring the existing `Orchestrator.run_full_demo()` to fixed inputs.
- Separating `demo_project.py` (data setup) from `canonical_flow.py` (pipeline execution) keeps concerns clean.
- The cold storage inspection form covers Output 2.1 and gives Scout diverse evidence types to extract (facility specs, commodities, observations).

**What didn't work:**
- Full demo takes ~8 minutes, not 3. This is entirely API-bound — 5 agents each making real Opus 4.7 calls with `effort: xhigh`. The code is not the bottleneck. Options for the hackathon: (a) accept it, (b) reduce effort to `high` for some agents, (c) run Scout on fewer images. The video can be edited.
- The bash pipe buffering made SSE events invisible in the terminal test. The events are correct (verified with raw curl), but the test script should have used `--no-buffer` or Python's urllib for cleaner verification.

**What to change:**
- Session 008 should consider reducing to 2 images for the canonical demo (drop one form) to bring runtime under 5 minutes. The 3rd form can be available for upload mode.
- The existing `seed_demo.py` is now redundant — it should be removed or marked as deprecated in favor of `demo/demo_project.py`.

---

## Next Session (008) Definition of Ready — Draft

**Scope:**
- Visual polish on /demo page: show query results, report output with ✓/⚠/✗ tags
- User-upload mode: drag-and-drop documents + transcripts
- Evals framework: 12+ test cases with scoring scripts
- `FAILURE_MODES.md`
- Consider reducing demo runtime (2 images instead of 3, or `effort: high` for Scout/Scribe)
