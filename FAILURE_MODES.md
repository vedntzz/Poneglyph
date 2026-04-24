# Failure Modes — Poneglyph

> What this system does *not* do well. Honest accounting.
>
> Each failure mode includes: what breaks, why it breaks, an observed example, and a proposed mitigation or acceptance rationale.

---

## FM-1: Auditor classifies CONTESTED claims as UNSUPPORTED

**What breaks:** When a draft claim directly contradicts the evidence (e.g., claim says "50 AgriMarts operational", evidence says 28), the Auditor tags it UNSUPPORTED rather than CONTESTED. The intended behavior is CONTESTED — the evidence exists and speaks to the topic, it just disagrees.

**Why it breaks:** The Auditor's adversarial posture (see `prompts/auditor.md`) instructs it to "assume claims are wrong until evidence forces otherwise." When evidence says 28 and the claim says 50, the model interprets this as "the evidence does not support the claim that 50 are operational" — which is literally true. The distinction between "no evidence exists" and "evidence exists but contradicts" requires the model to reason about degrees of support, which it doesn't reliably do under the current prompt.

**Observed example (eval run 2026-04-24):**

- Claim: "All 50 committed AgriMarts are now operational as of Q1."
- Evidence: "We have 42 in the pipeline — 28 fully operational, 14 with signed MoUs."
- Expected: CONTESTED (evidence contradicts the specific number)
- Actual: UNSUPPORTED ("The evidence directly contradicts the claim on multiple points")
- Same pattern for: "80% capacity / 400 MT stored" vs evidence showing 24% / 120 MT

**Impact:** 2/8 eval cases affected (25% of Auditor eval). Both were the CONTESTED category — 0% accuracy on CONTESTED, 100% on VERIFIED and UNSUPPORTED.

**Proposed mitigation:**
- Refine the Auditor prompt to explicitly distinguish three states: "evidence confirms" (VERIFIED), "evidence addresses the topic but disagrees" (CONTESTED), and "no relevant evidence exists" (UNSUPPORTED)
- Add examples in the prompt showing the CONTESTED case
- Alternatively, collapse CONTESTED and UNSUPPORTED into a single "NOT VERIFIED" tag with a reason field — simpler and avoids the ambiguity

**Accepted for hackathon?** Yes. The Auditor correctly catches the problem in both cases — it identifies that the claim is wrong and explains exactly how. The tag is less precise than ideal, but the downstream effect (PM sees the claim is flagged) is the same.

---

## FM-2: Scribe fails on long, multi-topic meeting transcripts

**What breaks:** Scribe returned 0 decisions, 0 commitments, and 0 open questions for eval_04 (World Bank pre-review preparation meeting) — the longest and most complex transcript in the eval set (3,504 characters, 6 attendees, 3 major topics reviewed).

**Why it breaks:** Root cause unconfirmed. Hypotheses:

1. **Tool output token limit**: The `record_meeting` tool must return all structured data in a single call. A meeting with 6+ commitments across 3 topics may produce tool output exceeding the model's willingness to pack into one tool call, causing it to return empty arrays rather than partial data.
2. **Multi-topic confusion**: The transcript covers Output 1 (FPC establishment), Output 2 (infrastructure), and Output 3 (training) in a single meeting. The model may struggle to organize commitments from multiple domains into a single structured response.
3. **Prompt interaction with long input**: The forced `tool_choice` constraint (no adaptive thinking allowed) may limit the model's ability to process longer inputs that benefit from extended reasoning.

**Observed example (eval run 2026-04-24):**

- Input: 3,504-character transcript, 6 attendees, ~8 decisions, ~6 commitments, 2 open questions
- Expected: 4-8 decisions, 5-8 commitments
- Actual: 0 decisions, 0 commitments, 0 open questions
- Other transcripts (843–2,860 chars) processed correctly

**Impact:** 1/5 Scribe eval cases (20%). The failed case is the most realistic meeting type — complex, multi-stakeholder, multi-topic.

**Proposed mitigation:**
- Investigate whether the model returned a malformed tool response or simply empty arrays
- Test whether splitting the user message into "first extract decisions, then commitments" improves reliability
- Consider using `tool_choice: "any"` with thinking enabled for longer transcripts (tradeoff: less reliable structured output but more reasoning capacity)
- For the hackathon demo: the canonical demo uses 2 shorter transcripts that process reliably

**Accepted for hackathon?** Yes, reluctantly. The demo uses shorter transcripts that work. But this is a real production concern — project review meetings are routinely 1+ hours with 5+ topics.

---

## FM-3: Scout eval uses synthetic typed text, not real handwritten forms

**What breaks:** Scout achieved 100% extraction success and near-universal HIGH confidence across all 12 eval images. This is misleadingly good because all test images are PIL-generated typed text — even the "handwritten-style" category uses typed fonts with slight positional jitter, not actual handwriting.

**Why it breaks:** Real field forms in Indian development projects feature:

- Handwritten Devanagari script (and sometimes regional scripts like Mithilakshar, Gondi, or Odia)
- Faded ink, creased paper, partial erasures
- Stamps overlapping text
- Mixed orientations (landscape forms photographed at an angle)
- Low-resolution phone camera captures with uneven lighting

None of these challenges are present in the eval set. Scout's 100% rate on typed text tells us the extraction pipeline works — it does not tell us how the system would perform on real field conditions.

**Observed example:** The "handwritten-style" eval images (eval_hw_01 through eval_hw_04) use dark blue ink-colored typed text on off-white backgrounds. The model processes these identically to the clean typed forms. Zero degradation in confidence or accuracy.

**Impact:** The entire Scout eval (12/12) has an optimistic bias. Real-world accuracy on handwritten forms is unknown and likely substantially lower.

**Proposed mitigation:**
- Obtain and scan real field forms from Synergy Technofin's past projects (redacted)
- Test with phone camera captures of paper forms under varying conditions
- Add intentional degradation: rotation, blur, partial occlusion, low contrast
- For the hackathon: disclose this limitation honestly. The demo uses typed synthetic forms and we say so.

**Accepted for hackathon?** Yes. We can't manufacture real handwritten test data in 4 days. The limitation is disclosed here and in the video/README. Scout's pixel-coordinate vision is the genuine feature — the eval gap is in input difficulty, not capability.

---

## FM-4: Contradiction detection only tested on 2-meeting pairs

**What breaks:** Archivist contradiction detection scored 3/3 on seeded walk-backs. But every test case involves exactly 2 meetings with one clear contradiction. Real projects have 10–20 meetings over 6–12 months, where commitments drift gradually across 3+ meetings — not a single abrupt change.

**Why it breaks:** The `detect_contradictions()` method loads all meetings and commitments into a single context and reasons across them in one call. This works for 2 meetings. With 10+ meetings, the model faces:

- More text in context → diluted attention on any specific pair of contradicting statements
- Gradual drift is harder to detect than abrupt walk-backs (e.g., target moves from 500 → 480 → 450 → 400 across 4 meetings, each step plausible)
- Acknowledged revisions mixed with unacknowledged ones — the model must distinguish these at scale

**Observed example:** In Session 004, the original AgriMart walk-back (50 → 42) was detected only 1/3 times when the meeting transcript included partial acknowledgment dialogue. After rewriting the transcript to make the walk-back fully silent, detection went to 5/5. This suggests the model's ability to distinguish acknowledged vs. unacknowledged changes is sensitive to phrasing.

**Impact:** The 3/3 contradiction detection rate is honest for the tested scenario but does not extrapolate to real-world project complexity.

**Proposed mitigation:**
- Build a 5-meeting eval chain with gradual drift across multiple sessions
- Test with acknowledged revisions mixed in alongside unacknowledged ones
- Consider a sliding-window approach for long meeting histories (compare meeting N against meetings N-1, N-2, N-3 rather than loading everything)
- For the hackathon: the demo uses 2 meetings, which is the tested scenario

**Accepted for hackathon?** Yes. The 2-meeting demo is genuine and the feature is real. The limitation on scale is documented here.

---

## FM-5: Demo pipeline latency variance (7:28–9:30)

**What breaks:** The canonical demo flow (3 images + 2 transcripts → Scout → Scribe → Archivist → Drafter → Auditor) takes 7–9+ minutes end-to-end. This is entirely API-bound — 5 agents each making real Opus 4.7 calls. The variance comes from API response time fluctuations, not code.

**Why it breaks:** Each agent makes 1–8 API calls (Scout: 3 calls for 3 images, Scribe: 2 calls for 2 transcripts, Archivist: 2–4 calls in agentic loop, Drafter: 3–5 calls in agentic loop, Auditor: 3–6 calls including vision checks). Total: ~15–20 API round-trips. At 15–30 seconds per call, the range is inherent.

**Observed example (Session 007):** Full canonical demo completed in ~8 minutes. No timeout or failure, but the judges viewing a live demo may experience the slow end of the range.

**Impact:** Not a correctness issue — the demo always completes. But a 9-minute live wait could lose audience attention during a 3-minute video pitch.

**Proposed mitigation:**
- The video can be edited to compress the wait (show the pipeline starting, cut to results)
- For live demos: run the pipeline before the presentation and show the completed state, with the option to re-run live if asked
- Reduce to 2 images instead of 3 to save ~90 seconds
- Lower effort level from `xhigh` to `high` for Scout and Scribe (tradeoff: potentially lower extraction quality)

**Accepted for hackathon?** Yes. The video handles this. Live demos are pre-warmed.

---

## FM-6: Single-project scope

**What breaks:** Poneglyph supports one project at a time. The `ProjectMemory` class uses a single `data_dir` with flat file paths. There is no project isolation, multi-tenancy, or cross-project querying.

**Why it breaks:** Deliberate hackathon scope decision. Building multi-project support would require:
- Project ID scoping on every memory operation
- A project registry / selection UI
- Cross-project Archivist queries ("compare progress across District A and District B")
- Access control (who can see which project)

None of these are needed for the demo.

**Observed example:** The `ProjectMemory` constructor accepts a `data_dir` and creates project subdirectories, but every agent call requires an explicit `project_id` parameter that must match what was created. There's no project discovery or listing API.

**Impact:** Zero impact on the hackathon demo. Significant gap for production use.

**Proposed mitigation:** Production system would need a project registry, probably backed by a database (not flat files), with RBAC. The flat-file memory architecture is the showcase for Opus 4.7's file-system-based persistent memory — it's a feature for the hackathon, but would need to evolve for real deployment.

**Accepted for hackathon?** Yes. This is by design.

---

## FM-7: No real Hindi/Devanagari script in eval data

**What breaks:** All "Hindi" test data uses transliterated Hindi in Latin script (e.g., "Mahila PHM Prashikshan" instead of "महिला PHM प्रशिक्षण"). The system has never been tested on actual Devanagari script documents.

**Why it breaks:** The PIL image generator uses system fonts that may not include Devanagari glyphs. We opted for transliterated bilingual text so the images render reliably on any build machine. Real Indian government forms use Devanagari headers with English data fields — a mixed-script layout that Opus 4.7's vision should handle but we haven't verified.

**Observed example:** `eval_hi_01.png` header reads "SAMOOH BAITHAK REGISTER / SHG MEETING REGISTER" — romanized Hindi, not Devanagari. A real SHG register would have "समूह बैठक रजिस्टर" at the top.

**Impact:** Unknown. Opus 4.7's vision claims to support multilingual text, but our eval doesn't exercise this. Any claim about Hindi language support is aspirational, not demonstrated.

**Proposed mitigation:**
- Generate test images using a Devanagari font (e.g., Noto Sans Devanagari)
- Test with real scanned Hindi government forms (redacted)
- Add Devanagari-specific eval cases to the Scout eval suite

**Accepted for hackathon?** Yes, reluctantly. Disclosed honestly. We call the project "multilingual" in the README but our evals only demonstrate bilingual romanized text.

---

## How to Read This Document

Each failure mode follows the same structure:
1. **What breaks** — the observable symptom
2. **Why it breaks** — root cause or hypothesis
3. **Observed example** — specific test case or run data
4. **Impact** — how many eval cases affected, production severity
5. **Proposed mitigation** — what we'd do with more time
6. **Accepted for hackathon?** — honest judgment call

This document is a companion to [EVALS.md](EVALS.md). The eval results show the numbers; this document explains the failures behind the numbers.
