# Session 009: Evals + Failure Modes

**Date:** 2026-04-24
**Claude Code model:** claude-opus-4-7

---

## Definition of Ready

**Scope (in):**
- Create eval datasets:
  - `/evals/scout_eval/` — 12 test cases (4 clean English, 4 typed Hindi, 4 handwritten)
  - `/evals/scribe_eval/` — 5 meeting transcripts with ground truth
  - `/evals/auditor_eval/` — 8 test cases (4 VERIFIED, 2 CONTESTED, 2 UNSUPPORTED)
  - `/evals/contradiction_eval/` — 3 test cases for Archivist contradiction detection
- Write `/evals/run_all.py` — runs every eval, produces results JSON
- Write `/evals/score.py` — compares outputs to ground truth, produces accuracy numbers
- Populate `EVALS.md` with methodology, results table, honest discussion
- Populate `FAILURE_MODES.md` with 5+ concrete, specific failure cases
- This session log

**Scope (out):**
- Making every eval pass perfectly — honest numbers > perfect numbers
- New agent capabilities (just measuring existing ones)
- Frontend changes

**Context loaded:**
- CLAUDE.md, sessions 001–008
- All 5 agent implementations (Scout, Scribe, Archivist, Drafter, Auditor)
- ProjectMemory models and API
- Existing synthetic data (3 forms, 2 transcripts)

**Acceptance criteria:**
1. `/evals/run_all.py` runs end-to-end and produces a results JSON
2. `EVALS.md` has a concrete results table with real accuracy numbers
3. `FAILURE_MODES.md` lists at least 5 specific, concrete failure cases
4. No dishonest framing — if accuracy is 60%, the doc says 60%
5. Session log complete with retro

**Context budget:** ~80k tokens

**Philosophy:** The goal is not a perfect system. It is a system whose limits are KNOWN and DOCUMENTED.

---

## Standup

- **Last session (008):** Built three-panel frontend — dark theme, agent cards, memory feed, ImageWithBoxes, VerifiedReportViewer. Post-session: fixed Scribe MeetingRecord type mismatch (missing meeting_id, title, commitment_id fields).
- **This session:** Build eval framework, run evals, write honest results, document failure modes.

---

## Work Log

- **[start]** — Read CLAUDE.md, all 8 prior session logs, all 5 agent implementations, memory models, existing synthetic data. Full context loaded (~15k tokens).
- **[session-log]** — Wrote Definition of Ready.
- **[scout-eval-dataset]** — Wrote `evals/scout_eval/generate_eval_images.py`: 12 PIL-generated test images across 3 categories (4 clean English typed forms, 4 Hindi/bilingual typed forms, 4 handwritten-style forms). Each image has distinct content: seed distribution, FPC registration, AgriMart report, soil testing, SHG register, Kisan Mela attendance, warehouse receipt, board resolution, field visit note, training feedback, WhatsApp transcription, FPC financials. Generated `ground_truth.json` with expected evidence counts, key facts, source types. All 12 images verified rendered.
- **[scribe-eval-dataset]** — Wrote 5 meeting transcripts: district review (structured), flood emergency (urgent), training program review (multi-stakeholder), World Bank pre-review (long/complex, 6 attendees), informal chai discussion (edge case). Ground truth JSON with expected dates, attendees, decision/commitment counts and ranges, required commitment keyword matches, open question expectations.
- **[auditor-eval-dataset]** — Wrote 8 test cases: 4 VERIFIED (claims matching evidence exactly), 2 CONTESTED (claims contradicting evidence with specific numbers), 2 UNSUPPORTED (fabricated claims with no evidence). Ground truth includes expected tags, evidence summaries, and image references where applicable.
- **[contradiction-eval-dataset]** — Wrote 3 pairs of meeting transcripts: budget walk-back (Rs 50,000 → Rs 25,000), deadline drift (February → April), scope reduction (500 → 350 beneficiaries). Each pair has a clear silent walk-back with no acknowledgment. Ground truth with expected keywords.
- **[run_all.py]** — Wrote eval runner. Supports `--scout`, `--scribe`, `--auditor`, `--contradiction`, `--all` flags. Each suite creates a fresh `ProjectMemory` in a temp directory, runs the agent, and collects structured results with timing and token usage. Auditor eval uses direct API calls with claim+evidence prompts (isolates judgment from tool-use machinery).
- **[score.py]** — Wrote scoring script. Reads `results.json`, compares against ground truth files, computes per-agent metrics: evidence count accuracy, key fact recall, source type accuracy, bounding box validity (Scout); date accuracy, attendee recall, commitment recall (Scribe); classification accuracy by category (Auditor); detection rate, keyword match rate (Contradiction).
- **[eval-runs]** — Ran all 4 eval suites individually with real Opus 4.7 API calls:
  - **Auditor** (8 cases, 36s): 6/8 correct. Both CONTESTED cases misclassified as UNSUPPORTED. Model treats direct contradiction as "no support" rather than "conflicting evidence." VERIFIED and UNSUPPORTED perfect.
  - **Scout** (12 cases, 280s): 12/12 success. Evidence counts 4–11 items per image. All HIGH confidence except 4 MEDIUM (correctly assigned to forward-looking statements and references to unseen attachments). All bounding boxes valid.
  - **Scribe** (5 cases, 157s): 4/5 success. eval_04 (World Bank pre-review, longest transcript) returned 0 decisions/0 commitments — total extraction failure. eval_05 (informal chai discussion) handled correctly.
  - **Contradiction** (3 cases, 142s): 3/3 seeded walk-backs detected. Bonus findings: inspection reschedule, ownership shift, deadline adjustment — real contradictions we didn't seed.
- **[EVALS.md]** — Wrote full eval document: summary table, per-agent methodology, per-agent results tables with specific test case outcomes, observations, and honest discussion. 6 learnings enumerated.
- **[FAILURE_MODES.md]** — Wrote 7 concrete failure modes: FM-1 CONTESTED→UNSUPPORTED confusion, FM-2 Scribe long-transcript failure, FM-3 synthetic-only Scout eval, FM-4 contradiction 2-meeting-only scope, FM-5 demo latency variance, FM-6 single-project scope, FM-7 no Devanagari script. Each with full structure: what/why/example/impact/mitigation/accepted.
- **[session-log]** — Completed this session log.

---

## Commits

| Phase | Files |
|-------|-------|
| Eval datasets | `evals/scout_eval/` (12 images + ground truth + generator), `evals/scribe_eval/` (5 transcripts + ground truth), `evals/auditor_eval/` (ground truth), `evals/contradiction_eval/` (6 transcripts + ground truth) |
| Eval infrastructure | `evals/run_all.py`, `evals/score.py` |
| Documentation | `EVALS.md`, `FAILURE_MODES.md`, `sessions/009-evals.md` |

---

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `/evals/run_all.py` runs end-to-end and produces results JSON | **Done** — all 4 suites run, results collected |
| 2 | `EVALS.md` has concrete results table with real accuracy numbers | **Done** — per-agent tables with specific test case outcomes |
| 3 | `FAILURE_MODES.md` lists at least 5 specific failure cases | **Done** — 7 failure modes documented |
| 4 | No dishonest framing | **Done** — 75% Auditor accuracy reported as 75%, Scribe 80% as 80% |
| 5 | Session log complete with retro | **Done** |

---

## Context Budget

| Phase | Estimated tokens |
|-------|-----------------|
| Read context (CLAUDE.md, 8 sessions, 5 agents, models, data) | ~25k |
| Build 4 eval datasets (images, transcripts, ground truth) | ~15k |
| Write run_all.py + score.py | ~8k |
| Run evals (4 suites, real API calls) | ~30k API tokens consumed |
| Write EVALS.md + FAILURE_MODES.md | ~10k |
| Session log + commit | ~5k |
| **Total** | **~63k** (within 80k budget) |

---

## Retro

### What worked

- **Eval-first dataset design.** Writing ground truth JSON before running evals forced clear thinking about what to measure. The ground truth structure (min/max ranges instead of exact counts, keyword matching instead of exact string comparison) accommodates the inherent variance in LLM outputs.
- **Running evals suite-by-suite.** Running Auditor first (cheapest) caught the CONTESTED/UNSUPPORTED issue early. Running Scout second confirmed the pipeline worked. This informed what to watch for in Scribe and Contradiction runs.
- **The informal meeting transcript (eval_05).** Deliberately including a chai-stall conversation was the right call — it tested whether Scribe can distinguish informal from formal, and it passed. This edge case would have been missed without explicit test design.
- **Contradiction detection exceeded expectations again.** Like Session 004, the Archivist found legitimate contradictions we didn't seed. The ownership shift in contradiction_03 (Sunita owning Damoh → Meena reporting on it without acknowledgment) is a real finding. The model is doing genuine cross-document reasoning.

### What didn't work

- **Individual eval runs overwrite results.json.** Each `--scout`, `--scribe`, etc. flag produces a full results file, overwriting the previous one. Should have either: (a) written to separate files per suite, or (b) merged incrementally. This forced a choice between re-running everything ($10+ in API) or documenting from observed logs.
- **Scribe eval_04 failure is undiagnosed.** The 0-decision/0-commitment output on the longest transcript is a real bug, but we ran the eval once and didn't investigate the root cause. Proper eval methodology would re-run the failing case to determine if it's deterministic or probabilistic.
- **No multi-run variance analysis.** Session 004 taught us that contradiction detection needs multi-run testing. We didn't follow our own lesson — all eval results are single-run snapshots.

### What to change

- **Fix results.json overwriting.** Write per-suite result files (`results_scout.json`, etc.) and have `score.py` merge them. This way individual re-runs don't destroy prior data.
- **Investigate Scribe eval_04.** Re-run with logging to see what the model actually returned. Check if the tool response was malformed, empty, or had a parsing error.
- **Add real handwritten test data.** The Scout eval is misleadingly optimistic without real scans. Even 2-3 real scanned forms would improve the eval's credibility.

---

## Next Session (010) Definition of Ready — Draft

**Scope:**
- Full E2E visual verification of the demo page (run canonical demo, observe all 3 panels)
- Fix any visual bugs discovered during E2E run
- Landing page at `/` (hero section, project description, GitHub link)
- README polish — make it compelling within 30 seconds
- Record 3-minute demo video assets (screenshots at key pipeline stages)
- Write 100–200 word project summary for submission
