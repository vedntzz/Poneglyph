# Session 003: Scout Agent — Vision-Enabled Evidence Extractor

**Date:** 2026-04-23
**Claude Code model:** claude-opus-4-7

---

## Definition of Ready

**Scope (in):**
- Create `/backend/agents/scout.py` with class `ScoutAgent`
- Write system prompt at `/prompts/scout.md` — human-readable, with comments explaining each instruction
- Scout takes: (image bytes or path, project logframe) and returns list of Evidence objects
- Each Evidence includes: raw_text, interpreted_claim (summary), logframe_indicator, confidence, bounding_box (x1, y1, x2, y2 in native pixel coords), source_file
- Uses Opus 4.7 with high-res vision (no downsampling), tool-forced structured output
- Integrate with ProjectMemory: Scout writes each Evidence via `memory.add_evidence()`
- Add endpoint `POST /api/scout/extract` — accepts project_id + image upload, returns structured JSON
- Generate 2 synthetic test images in `/data/synthetic/` using PIL
- Write `/backend/agents/test_scout.py` — end-to-end test
- Update Evidence model: add `raw_text`, `confidence` fields; change bounding_boxes to x1/y1/x2/y2 format
- Session log

**Scope (out):**
- Frontend UI for bounding boxes (Session 008)
- Real Hindi handwritten forms (swapped in when available)
- Auditor verification pass (Session 005)

**Context loaded:**
- CLAUDE.md
- Sessions 001, 002
- `/backend/memory/models.py`, `/backend/memory/project_memory.py`, `/backend/main.py`

**Context budget:** ~60k tokens

---

## Standup

- **Last session (002):** Built ProjectMemory — Pydantic models (Evidence, Meeting, Commitment, etc.), file-system read/write, example binder. All tests passing.
- **This session:** Build Scout, the first real agent. Uses Opus 4.7's pixel-coordinate vision to extract evidence from scanned documents with bounding boxes. The hero feature.

---

## Work Log

- **[start]** — Read CLAUDE.md, session logs 001–002, all backend code (main.py, memory models, project_memory.py, test_memory.py). Full context loaded.
- **[prompt]** — Wrote `/prompts/scout.md`. 8 rules, each with HTML comments explaining the reasoning. Key design: force tool use for structured output, require native pixel coordinates, separate raw_text from interpreted_claim so Auditor can verify.
- **[models]** — Updated Evidence model in `models.py`: added `Confidence` enum (HIGH/MEDIUM/LOW), `raw_text` field, `confidence` field. Changed `bounding_boxes` dict keys from `{x, y, width, height}` to `{x1, y1, x2, y2}` (matches CSS/canvas clipping convention). Updated `__init__.py` exports, `project_memory.py` enum serialization, and `test_memory.py` bounding box format. Ran `test_memory.py` — all assertions pass.
- **[agent]** — Created `/backend/agents/__init__.py` and `/backend/agents/scout.py`. ScoutAgent class with: `_load_system_prompt()` from `/prompts/scout.md`, `run()` that sends image + logframe to Opus 4.7, `_parse_tool_response()` for structured extraction, `_to_evidence()` for model conversion, `_resolve_image()` for path/bytes handling with magic byte detection. Tool schema (`record_evidence`) defined inline with full JSON Schema for evidence items.
- **[images]** — Created `/data/synthetic/generate_test_images.py` using PIL. Two 1500x2000px images: `form_english.png` (beneficiary registration, Sagar district, 47 farmers) and `form_hindi.png` (PHM training attendance, Gumla village, transliterated Hindi/English). Both verified visually.
- **[endpoint]** — Added `POST /api/scout/extract` to `main.py`. Accepts project_id (Form) + image (File upload). Reads logframe from ProjectMemory, runs Scout, returns structured JSON with bounding boxes. Added `pillow` and `python-multipart` as dependencies.
- **[api-fix]** — First test run failed: `"Thinking may not be enabled when tool_choice forces tool use."` Opus 4.7 constraint — adaptive thinking conflicts with forced tool_choice. Removed `thinking` and `output_config` from Scout's API call. Forced tool use is more important for reliable structured output than extended thinking.
- **[test-minimal]** — Wrote `test_scout_minimal.py` with a tiny 200x100 image ("47 farmers registered") to validate the pipeline with minimal API tokens. Passed: 1 evidence item, bounding box `(16,38)→(196,60)`, confidence HIGH.
- **[test-full]** — Ran `test_scout.py` on both synthetic form images. English form: 6 evidence items. Hindi form: 7 evidence items. All HIGH confidence. All bounding boxes within image dimensions (1500x2000). All persisted to ProjectMemory (13 items total). All assertions pass.

---

## Context Budget

| Step | Estimated tokens | Actual |
|------|-----------------|--------|
| Read context (CLAUDE.md + sessions + backend code) | ~8k | ~8k |
| Design and write system prompt | ~5k | ~5k |
| Update Evidence model + fix existing test | ~4k | ~3k |
| ScoutAgent class implementation | ~12k | ~12k |
| Synthetic test images (PIL script) | ~3k | ~4k |
| API endpoint in main.py | ~5k | ~5k |
| test_scout.py + minimal test + API fix | ~5k | ~8k |
| Session log + retro | ~3k | ~3k |
| **Total** | **~45k** | **~48k** |

---

## Retro

**What worked:**
- Writing the system prompt before the code was the right call. The 8 rules with comments forced clear thinking about what Scout needs to do, and the tool schema fell out naturally from the prompt design.
- Tool-forced structured output (`tool_choice: {"type": "tool", "name": "record_evidence"}`) works perfectly. Every response is valid JSON matching the schema. No parsing failures.
- Opus 4.7's pixel-coordinate vision is genuinely impressive. Bounding boxes on both test images are tight and accurate — `(16,38)→(196,60)` for a tiny 200x100 image with small text. This is the hero feature.
- The minimal test strategy saved significant API cost. Testing the full pipeline on a 200x100 image before committing to 1500x2000 images caught the thinking+tool_choice conflict cheaply.
- Separating `raw_text` from `summary` (interpreted claim) in the Evidence model is already paying off. Scout returns the verbatim text alongside its interpretation, giving Auditor something concrete to verify against.

**What didn't work:**
- `thinking: {"type": "adaptive"}` cannot be combined with forced `tool_choice` — API returns 400. Discovered at runtime. The CLAUDE.md says "always use adaptive thinking" but this is an API constraint we can't work around when we need reliable structured output.
- `output_config: {"effort": "xhigh"}` was also removed alongside thinking. Need to verify whether effort works independently of thinking in a future session.

**What to change next time:**
- Test API parameter combinations on a cheap call before building the full pipeline around them. The thinking+tool_choice conflict could have been caught in 2 seconds with a minimal API call.
- Consider using `tool_choice: {"type": "any"}` with `thinking` enabled as an alternative — model must use a tool but isn't locked to a specific one. With only one tool defined, it should still pick `record_evidence`. Worth testing.

---

## Files Changed

| File | Change |
|------|--------|
| `/prompts/scout.md` | **New.** System prompt with 8 rules, HTML comments explaining each. |
| `/backend/agents/__init__.py` | **New.** Package init. |
| `/backend/agents/scout.py` | **New.** ScoutAgent class, tool schema, image handling. |
| `/backend/agents/test_scout.py` | **New.** Full end-to-end test on synthetic images. |
| `/backend/agents/test_scout_minimal.py` | **New.** Minimal pipeline test (tiny image). |
| `/backend/memory/models.py` | **Modified.** Added Confidence enum, raw_text and confidence fields to Evidence, changed bounding_boxes to x1/y1/x2/y2. |
| `/backend/memory/__init__.py` | **Modified.** Export Confidence. |
| `/backend/memory/project_memory.py` | **Modified.** Handle Confidence enum serialization in add_evidence. |
| `/backend/memory/test_memory.py` | **Modified.** Updated bounding_boxes to new format. |
| `/backend/main.py` | **Modified.** Added POST /api/scout/extract endpoint with Scout integration. |
| `/backend/pyproject.toml` | **Modified.** Added pillow, python-multipart dependencies. |
| `/data/synthetic/generate_test_images.py` | **New.** PIL script for test form images. |
| `/data/synthetic/form_english.png` | **New.** 1500x2000 synthetic English registration form. |
| `/data/synthetic/form_hindi.png` | **New.** 1500x2000 synthetic Hindi/English training attendance. |
| `/sessions/003-scout.md` | **New.** This session log. |

---

## Next Session Definition of Ready (Draft)

**Session 004: Scribe + Archivist**
- Create ScribeAgent — processes meeting transcripts, extracts decisions/commitments/open questions, writes structured MoMs
- Create ArchivistAgent — owns ProjectMemory, reads/writes notes, detects contradictions across time
- Write system prompts for both in `/prompts/`
- Add API endpoints for both
- Write ARCHITECTURE.md with the real system design (now that we have concrete agent implementations)
- Test both agents end-to-end

### Open question for Auditor design (Session 005)

Scout's `interpreted_claim` often draws on multiple regions of the
document, not just the single `bounding_boxes` location it cites.
Example: ev-8da24fdc's claim "47 farmers in Rahatgarh village on
18 April" is anchored to the "Total beneficiaries: 47" line, but
the village and date come from the form header.

Implication for Session 005: when Auditor re-verifies a claim
against the source image, it needs to re-read the whole document,
not just the cropped bounding box region. Load full image + claim,
ask Opus to verify — don't crop.