# Evals — Poneglyph

> Honest numbers on what works and what doesn't.
> Run date: 2026-04-24. Model: `claude-opus-4-7`. All calls use real API — no mocks.

---

## Summary

| Agent | Test Cases | Pass Rate | Key Metric | Notes |
|-------|-----------|-----------|------------|-------|
| Scout | 12 | 12/12 (100%) | Key fact recall ~85% | All typed forms; handwritten at scale untested |
| Scribe | 5 | 4/5 (80%) | Required commitment recall ~75% | Long multi-topic transcript failure (eval 4) |
| Auditor | 8 | 6/8 (75%) | Classification accuracy 75% | CONTESTED → UNSUPPORTED confusion |
| Archivist (contradiction) | 3 | 3/3 (100%) | All seeded walk-backs detected | Only 2-meeting pairs tested |

**28 test cases total. Overall success: 25/28 (89%).**

Caveats: small sample size, synthetic data only, single-run results (no multi-run variance testing except where noted). Human-written ground truth may be imperfect.

---

## Methodology

### Test case construction

All test data is synthetic, generated specifically for evaluation. No real project data was used. Synthetic data is labeled as such in every file header. Test cases were designed to cover:

- **Breadth of document types**: registration forms, inspection reports, financial summaries, meeting transcripts of varying formality, WhatsApp transcriptions
- **Known edge cases**: bilingual text, informal meetings, fabricated claims, silent contradictions
- **Graduated difficulty**: clean typed → bilingual typed → handwritten-style

### Scoring approach

- **Scout**: evidence count within expected range, key fact recall (keyword matching against ground truth facts), source type classification, bounding box geometric validity
- **Scribe**: exact date match, attendee recall, decision/commitment counts within expected ranges, required commitment keyword matching
- **Auditor**: classification accuracy (predicted tag vs expected tag) across three categories
- **Contradiction**: detection rate (any contradiction found) and keyword match rate (correct contradiction identified)

Scoring scripts: `/evals/score.py`. Raw results: `/evals/results.json`.

### Limitations of this eval

1. **Small sample size.** 28 test cases across 4 agents. Not statistically significant — these are smoke tests, not benchmarks.
2. **Synthetic data only.** All images are PIL-generated typed text. Real scanned forms with creases, stamps, handwriting, and ink variation are materially harder.
3. **Single run.** Session 004 demonstrated that contradiction detection varies across runs (1/3 → 5/5 on the AgriMart walk-back). These results are a single snapshot.
4. **Ground truth is human-authored.** The expected facts, counts, and tags were written by the developers. An independent evaluator might draw different ground truth.
5. **No adversarial test cases.** We did not test deliberate prompt injection, misleading document layouts, or documents designed to confuse the agents.

---

## Per-Agent Results

### Scout — Evidence Extraction (12 test cases)

**Test set**: 4 clean English typed forms, 4 Hindi/bilingual typed forms, 4 handwritten-style forms. All 1500×2000px PNG images generated with PIL.

| Test Case | Category | Evidence Items | All HIGH Confidence | Key Facts Found |
|-----------|----------|---------------|-------------------|-----------------|
| eval_en_01 (seed distribution) | English typed | 4 | Yes | 35 farmers, 720 kg, 14 women |
| eval_en_02 (FPC registration) | English typed | 9 | Yes | 8 FPCs, 416 members, 38.5% women |
| eval_en_03 (AgriMart report) | English typed | 5 | Yes | Rs 1,79,000 revenue, 89 farmers |
| eval_en_04 (soil testing camp) | English typed | 4 | Yes | 63 farmers, 28 women, 63 samples |
| eval_hi_01 (SHG meeting) | Hindi typed | 7 | 5 HIGH, 2 MEDIUM | Rs 2,400 savings, 12/15 present |
| eval_hi_02 (Kisan Mela) | Hindi typed | 4 | Yes | 215 farmers, 78 women, 86% useful |
| eval_hi_03 (warehouse receipt) | Hindi typed | 4 | Yes | 45 MT, WR-2026-0087, Rs 1.50/kg |
| eval_hi_04 (FPC board resolution) | Hindi typed | 11 | Yes | Rs 15 lakh NABARD, 50 new members |
| eval_hw_01 (field visit note) | Handwritten-style | 7 | Yes | 67 vs 82 farmers, 15 duplicates |
| eval_hw_02 (training feedback) | Handwritten-style | 5 | Yes | 38 participants, 4.2/5 rating |
| eval_hw_03 (WhatsApp update) | Handwritten-style | 7 | 5 HIGH, 2 MEDIUM | 3 AgriMart statuses, PHM materials |
| eval_hw_04 (FPC financials) | Handwritten-style | 8 | Yes | Rs 3,80,000 revenue, 156 members |

**Key observations:**

- **100% extraction success** — Scout returned evidence from every image, no failures.
- **Evidence count range: 4–11 items per image.** Denser documents (FPC board resolution) produce more items. Scout appropriately splits atomic facts.
- **Confidence calibration**: MEDIUM confidence correctly assigned to forward-looking statements (planned AgriMart purchase, upcoming PHM training) and to claims about attached photos not visible in the image.
- **Bounding boxes**: all within image dimensions (1500×2000), geometrically valid (x2 > x1, y2 > y1).
- **Logframe mapping**: Scout correctly maps evidence to indicators when the document cites them explicitly. When the document doesn't mention an indicator, Scout maps to null — conservative and correct.
- **Limitation**: "handwritten-style" forms are still typed text with jitter. Real handwritten Devanagari on noisy paper would be significantly harder. See FAILURE_MODES.md.

### Scribe — Meeting Intelligence (5 test cases)

**Test set**: 5 meeting transcripts of increasing difficulty — from a structured district review to an informal chai-stall conversation.

| Test Case | Decisions | Commitments | Open Questions | Attendees | Date Correct |
|-----------|-----------|-------------|---------------|-----------|-------------|
| eval_01 (district review) | 4 | 4 | 3 | 4/4 | Yes |
| eval_02 (flood emergency) | 7 | 6 | 5 | 4/4 | Yes |
| eval_03 (training review) | 5 | 4 | 2 | 4/4 | Yes |
| eval_04 (World Bank pre-review) | **0** | **0** | **0** | — | — |
| eval_05 (informal chai discussion) | 0 | 1 | 5 | 2+ | Yes |

**Key observations:**

- **4/5 transcripts processed correctly.** Decisions, commitments, and open questions extracted with appropriate granularity.
- **eval_04 total failure**: the longest and most complex transcript (6 attendees, multiple indicators reviewed, 6+ commitments) returned 0 decisions, 0 commitments, and 0 open questions. This is the most important failure in the eval set. Root cause unconfirmed — likely the combination of transcript length + forced tool_choice hitting a token or parsing edge case. See FAILURE_MODES.md.
- **eval_05 correctly handled informal tone**: Scribe recognized the chai-stall discussion as informal, extracted 1 commitment (Ankit to raise sorting center idea), identified 5 open questions (storage rate, sorting center feasibility), and appropriately found 0 formal decisions.
- **Commitment owner matching**: owners are correctly attributed to the person who made the promise, not the person they promised to.
- **Relative date resolution**: due dates like "by end of this week" are resolved to absolute dates using the meeting date.

### Auditor — Claim Verification (8 test cases)

**Test set**: 4 claims that should verify, 2 that should be contested, 2 that should be unsupported. Claims tested against both text evidence summaries and source document images.

| Test Case | Expected | Predicted | Correct | Vision Used |
|-----------|----------|-----------|---------|-------------|
| audit_verified_01 (47 farmers in Rahatgarh) | VERIFIED | VERIFIED | Yes | Yes (image) |
| audit_verified_02 (cold storage 500 MT) | VERIFIED | VERIFIED | Yes | Yes (image) |
| audit_verified_03 (50 AgriMarts commitment) | VERIFIED | VERIFIED | Yes | No |
| audit_verified_04 (47 women PHM training) | VERIFIED | VERIFIED | Yes | Yes (image) |
| audit_contested_01 (all 50 AgriMarts operational) | CONTESTED | **UNSUPPORTED** | **No** | No |
| audit_contested_02 (80% cold storage utilization) | CONTESTED | **UNSUPPORTED** | **No** | Yes (image) |
| audit_unsupported_01 (gender audit 95%) | UNSUPPORTED | UNSUPPORTED | Yes | No |
| audit_unsupported_02 (NABARD Rs 50 crore MoU) | UNSUPPORTED | UNSUPPORTED | Yes | No |

**Key observations:**

- **4/4 VERIFIED correct.** When evidence supports a claim, the Auditor confirms it reliably. Vision-based verification works — the Auditor independently reads source images and confirms facts.
- **2/2 UNSUPPORTED correct.** Fabricated claims (no evidence exists) are reliably caught.
- **0/2 CONTESTED correct.** Both CONTESTED claims were classified as UNSUPPORTED. The Auditor's adversarial posture treats direct contradiction as "evidence does not support" rather than "evidence partially supports." When a claim says 50 and evidence says 28, the model reads this as the claim having no support — not as contested. This is a judgment edge case, not a bug. See FAILURE_MODES.md for full discussion.
- **Implication**: in production, UNSUPPORTED and CONTESTED may need to be collapsed into a single "not verified" category, or the prompt needs to be refined to distinguish "no evidence" from "contradicting evidence."

### Archivist — Contradiction Detection (3 test cases)

**Test set**: 3 pairs of meeting transcripts, each containing one seeded silent walk-back (budget reduction, deadline drift, scope reduction).

| Test Case | Contradictions Found | Primary Walk-Back Detected | Severity | Extra Findings |
|-----------|---------------------|---------------------------|----------|---------------|
| contradiction_01 (budget Rs 50k → 25k) | 1 | Yes | Medium | — |
| contradiction_02 (deadline Feb → April) | 2 | Yes | High | Also caught inspection reschedule |
| contradiction_03 (beneficiaries 500 → 350) | 3 | Yes | High | Also caught deadline change and ownership shift |

**Key observations:**

- **3/3 primary contradictions detected.** Every seeded walk-back was identified.
- **Bonus findings**: Archivist found additional legitimate contradictions we didn't seed — the inspection date reschedule (contradiction_02) and the ownership shift in Damoh distribution (contradiction_03). These are real contradictions in the test data that we didn't anticipate.
- **Severity calibration**: budget reduction tagged medium (ambiguous — could be cost optimization), deadline drift tagged high (missed commitment), scope reduction tagged high (target change). Reasonable.
- **Limitation**: only tested 2-meeting pairs. Real projects have 10+ meetings with gradual drift across many sessions. See FAILURE_MODES.md.

---

## What We Learned

1. **Structured extraction is reliable.** Scout and Scribe consistently return well-formed structured output when using forced tool_choice. The tool schema acts as a contract.
2. **Judgment tasks are harder than extraction tasks.** Auditor classification (75%) and Scribe on complex transcripts (80%) show lower reliability than Scout extraction (100%).
3. **The CONTESTED category is genuinely hard.** Distinguishing "partial support" from "no support" requires nuanced reasoning about degrees of evidence. This is hard for humans too.
4. **Contradiction detection works better than expected.** Finding implicit walk-backs across documents is exactly the kind of cross-document reasoning that Opus 4.7's large context window enables.
5. **Informal inputs are handled well.** The chai-stall transcript (eval_05) and WhatsApp transcription (eval_hw_03) were processed correctly despite being unstructured.
6. **We need more test cases.** 28 is a smoke test. A real eval would need 100+ cases with multi-run variance analysis.
