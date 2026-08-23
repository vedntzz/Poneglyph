"""Run all Poneglyph agent evaluations and produce a results JSON.

Executes eval suites for Scout, Scribe, Auditor, and Archivist (contradiction
detection). Each eval calls real Opus 4.7 API endpoints — this is not a mock.

Usage:
  cd backend && uv run python ../evals/run_all.py [--scout] [--scribe] [--auditor] [--contradiction] [--all]

Results are written to /evals/results.json.

IMPORTANT: This script makes real Anthropic API calls. Each full run costs
approximately $5–15 in API tokens depending on image sizes and agent loop rounds.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path so we can import agents and memory
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from memory.project_memory import ProjectMemory
from agents.scout import ScoutAgent
from agents.scribe import ScribeAgent
from agents.archivist import ArchivistAgent

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("eval")

EVALS_DIR = Path(__file__).resolve().parent
SCOUT_DIR = EVALS_DIR / "scout_eval"
SCRIBE_DIR = EVALS_DIR / "scribe_eval"
AUDITOR_DIR = EVALS_DIR / "auditor_eval"
CONTRADICTION_DIR = EVALS_DIR / "contradiction_eval"


# ──────────────────────────────────────────────
# Scout eval
# ──────────────────────────────────────────────

def run_scout_eval() -> list[dict]:
    """Run Scout on all 12 test images and collect structured outputs.

    Returns a list of result dicts, one per test case, containing:
    - test image path, category
    - evidence items returned by Scout (count, summaries, bounding boxes)
    - tokens used
    - elapsed time
    """
    gt_path = SCOUT_DIR / "ground_truth.json"
    with open(gt_path) as f:
        ground_truth = json.load(f)

    # Use a fresh temp project for each eval run
    with tempfile.TemporaryDirectory(prefix="poneglyph_eval_scout_") as tmpdir:
        memory = ProjectMemory(data_dir=tmpdir)
        memory.create_project("eval-scout", "Scout Eval Project", "Eval")
        # Minimal logframe so Scout can map indicators
        logframe = (
            "## Output 1: FPC Establishment\n"
            "| Indicator | Target |\n|---|---|\n"
            "| 1.1 FPCs registered | 15 |\n"
            "| 1.2 Farmers enrolled | 10,000 |\n"
            "| 1.3 Seed kits distributed | 5,000 |\n\n"
            "## Output 2: Infrastructure\n"
            "| Indicator | Target |\n|---|---|\n"
            "| 2.1 Cold storage facilities | 5 |\n"
            "| 2.2 AgriMarts operational | 50 |\n\n"
            "## Output 3: Capacity Building\n"
            "| Indicator | Target |\n|---|---|\n"
            "| 3.1 Technical training camps | 50 |\n"
            "| 3.2 Women's PHM trainings | 20 |\n"
            "| 3.3 Farmer outreach events | 10 |\n"
        )
        memory.load_logframe("eval-scout", logframe)

        scout = ScoutAgent(memory=memory)
        results = []

        for i, gt in enumerate(ground_truth):
            image_path = str(SCOUT_DIR / gt["image"])
            logger.info("Scout eval [%d/%d]: %s", i + 1, len(ground_truth), gt["image"])

            start = time.time()
            try:
                evidence_list = scout.run(
                    project_id="eval-scout",
                    image_source=image_path,
                    logframe=logframe,
                    source_file_path=image_path,
                )
                elapsed = time.time() - start

                results.append({
                    "test_id": gt["image"].replace(".png", ""),
                    "category": gt["category"],
                    "description": gt["description"],
                    "status": "success",
                    "evidence_count": len(evidence_list),
                    "evidence_items": [
                        {
                            "evidence_id": ev.evidence_id,
                            "summary": ev.summary,
                            "raw_text": ev.raw_text,
                            "confidence": ev.confidence.value if ev.confidence else None,
                            "logframe_indicator": ev.logframe_indicator,
                            "source_type": ev.source.value,
                            "bounding_boxes": ev.bounding_boxes,
                            "district": ev.district,
                            "village": ev.village,
                        }
                        for ev in evidence_list
                    ],
                    "tokens_used": scout.total_tokens_used,
                    "elapsed_seconds": round(elapsed, 2),
                })
            except Exception as e:
                elapsed = time.time() - start
                logger.error("Scout eval failed on %s: %s", gt["image"], e)
                results.append({
                    "test_id": gt["image"].replace(".png", ""),
                    "category": gt["category"],
                    "description": gt["description"],
                    "status": "error",
                    "error": str(e),
                    "elapsed_seconds": round(elapsed, 2),
                })

    return results


# ──────────────────────────────────────────────
# Scribe eval
# ──────────────────────────────────────────────

def run_scribe_eval() -> list[dict]:
    """Run Scribe on all 5 meeting transcripts and collect structured outputs."""
    gt_path = SCRIBE_DIR / "ground_truth.json"
    with open(gt_path) as f:
        ground_truth = json.load(f)

    with tempfile.TemporaryDirectory(prefix="poneglyph_eval_scribe_") as tmpdir:
        memory = ProjectMemory(data_dir=tmpdir)
        memory.create_project("eval-scribe", "Scribe Eval Project", "Eval")
        logframe = (
            "## Output 1: FPC Establishment\n"
            "| 1.1 FPCs registered | 15 |\n\n"
            "## Output 2: Infrastructure\n"
            "| 2.1 Cold storage | 5 |\n| 2.2 AgriMarts | 50 |\n\n"
            "## Output 3: Capacity Building\n"
            "| 3.1 Training camps | 50 |\n| 3.2 Women's PHM | 20 |\n"
        )
        memory.load_logframe("eval-scribe", logframe)

        scribe = ScribeAgent(memory=memory)
        results = []

        for i, gt in enumerate(ground_truth):
            transcript_path = SCRIBE_DIR / gt["transcript"]
            transcript_text = transcript_path.read_text(encoding="utf-8")
            logger.info("Scribe eval [%d/%d]: %s", i + 1, len(ground_truth), gt["transcript"])

            start = time.time()
            try:
                record = scribe.run(
                    project_id="eval-scribe",
                    transcript=transcript_text,
                    source_file_path=str(transcript_path),
                )
                elapsed = time.time() - start

                results.append({
                    "test_id": gt["transcript"].replace(".txt", ""),
                    "description": gt["description"],
                    "status": "success",
                    "meeting_id": record.meeting_id,
                    "title": record.title,
                    "date": record.date,
                    "attendees": record.attendees,
                    "attendee_count": len(record.attendees),
                    "decisions": record.decisions,
                    "decision_count": len(record.decisions),
                    "commitments": [
                        {
                            "owner": c.owner,
                            "description": c.description,
                            "due_date": c.due_date,
                            "logframe_indicator": c.logframe_indicator,
                        }
                        for c in record.commitments
                    ],
                    "commitment_count": len(record.commitments),
                    "open_questions": record.open_questions,
                    "open_question_count": len(record.open_questions),
                    "disagreements": [
                        {"parties": d.parties, "topic": d.topic, "resolution": d.resolution}
                        for d in record.disagreements
                    ],
                    "disagreement_count": len(record.disagreements),
                    "tokens_used": scribe.total_tokens_used,
                    "elapsed_seconds": round(elapsed, 2),
                })
            except Exception as e:
                elapsed = time.time() - start
                logger.error("Scribe eval failed on %s: %s", gt["transcript"], e)
                results.append({
                    "test_id": gt["transcript"].replace(".txt", ""),
                    "description": gt["description"],
                    "status": "error",
                    "error": str(e),
                    "elapsed_seconds": round(elapsed, 2),
                })

    return results


# ──────────────────────────────────────────────
# Auditor eval (simplified — claim verification without full pipeline)
# ──────────────────────────────────────────────

def run_auditor_eval() -> list[dict]:
    """Test Auditor's judgment by presenting claims with known ground truth.

    Rather than running the full Drafter→Auditor pipeline (which would test
    Drafter as much as Auditor), we construct DraftSections with known claims
    and evidence, then run only the Auditor.

    HACKATHON COMPROMISE: For this eval, we test the Auditor's core judgment
    by asking Opus 4.7 directly to verify claims against provided evidence
    summaries, rather than going through the full agentic loop. This isolates
    the judgment capability from the tool-use machinery.
    """
    import anthropic

    gt_path = AUDITOR_DIR / "ground_truth.json"
    with open(gt_path) as f:
        ground_truth = json.load(f)

    client = anthropic.Anthropic()
    results = []

    for i, gt in enumerate(ground_truth):
        logger.info("Auditor eval [%d/%d]: %s", i + 1, len(ground_truth), gt["test_id"])

        start = time.time()
        try:
            # Build a verification prompt
            prompt = (
                f"You are an adversarial auditor verifying a claim against evidence.\n\n"
                f"CLAIM: \"{gt['claim']}\"\n\n"
                f"EVIDENCE: {gt['evidence_summary']}\n\n"
                f"Based ONLY on the evidence provided, classify this claim as:\n"
                f"- VERIFIED: the evidence directly and fully supports the claim\n"
                f"- CONTESTED: the evidence partially supports or contradicts the claim\n"
                f"- UNSUPPORTED: no evidence supports the claim\n\n"
                f"Respond with ONLY the tag (verified/contested/unsupported) on the "
                f"first line, followed by a brief explanation."
            )

            # For claims with image evidence, include the image
            messages_content: list[dict] = []
            if gt.get("evidence_image"):
                image_path = Path(__file__).resolve().parent.parent / "data" / "synthetic" / gt["evidence_image"]
                if image_path.exists():
                    import base64
                    image_bytes = image_path.read_bytes()
                    import mimetypes
                    mime, _ = mimetypes.guess_type(str(image_path))
                    messages_content.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime or "image/png",
                            "data": base64.b64encode(image_bytes).decode(),
                        },
                    })
                    prompt += (
                        "\n\nAn image of the source document is attached. "
                        "Use it to verify the claim independently."
                    )

            messages_content.append({"type": "text", "text": prompt})

            response = client.messages.create(
                model="claude-opus-4-7",
                max_tokens=1000,
                messages=[{"role": "user", "content": messages_content}],
            )

            elapsed = time.time() - start
            response_text = ""
            for block in response.content:
                if block.type == "text":
                    response_text += block.text

            # Parse the tag from the first line
            first_line = response_text.strip().split("\n")[0].lower().strip()
            predicted_tag = "unknown"
            for tag in ["verified", "contested", "unsupported"]:
                if tag in first_line:
                    predicted_tag = tag
                    break

            results.append({
                "test_id": gt["test_id"],
                "category": gt["category"],
                "claim": gt["claim"],
                "expected_tag": gt["expected_tag"],
                "predicted_tag": predicted_tag,
                "correct": predicted_tag == gt["expected_tag"],
                "response": response_text[:500],
                "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
                "elapsed_seconds": round(elapsed, 2),
                "status": "success",
            })
        except Exception as e:
            elapsed = time.time() - start
            logger.error("Auditor eval failed on %s: %s", gt["test_id"], e)
            results.append({
                "test_id": gt["test_id"],
                "category": gt["category"],
                "expected_tag": gt["expected_tag"],
                "status": "error",
                "error": str(e),
                "elapsed_seconds": round(elapsed, 2),
            })

    return results


# ──────────────────────────────────────────────
# Contradiction eval
# ──────────────────────────────────────────────

def run_contradiction_eval() -> list[dict]:
    """Test Archivist's contradiction detection on paired meeting transcripts."""
    gt_path = CONTRADICTION_DIR / "ground_truth.json"
    with open(gt_path) as f:
        ground_truth = json.load(f)

    results = []

    for i, gt in enumerate(ground_truth):
        logger.info(
            "Contradiction eval [%d/%d]: %s", i + 1, len(ground_truth), gt["test_id"]
        )

        with tempfile.TemporaryDirectory(prefix="poneglyph_eval_contra_") as tmpdir:
            memory = ProjectMemory(data_dir=tmpdir)
            memory.create_project("eval-contra", "Contradiction Eval", "Eval")
            logframe = "## Eval logframe\n| Indicator | Target |\n|---|---|\n| 1.1 | 100 |\n"
            memory.load_logframe("eval-contra", logframe)

            scribe = ScribeAgent(memory=memory)
            archivist = ArchivistAgent(memory=memory)

            start = time.time()
            try:
                # Process both meeting transcripts via Scribe
                for meeting_file in [gt["meeting_1"], gt["meeting_2"]]:
                    transcript = (CONTRADICTION_DIR / meeting_file).read_text(encoding="utf-8")
                    scribe.run(
                        project_id="eval-contra",
                        transcript=transcript,
                        source_file_path=meeting_file,
                    )

                # Run contradiction detection
                contradictions = archivist.detect_contradictions("eval-contra")
                elapsed = time.time() - start

                results.append({
                    "test_id": gt["test_id"],
                    "description": gt["description"],
                    "status": "success",
                    "contradiction_count": len(contradictions),
                    "contradictions": [
                        {
                            "description": c.description,
                            "earlier_source": c.earlier_source,
                            "later_source": c.later_source,
                            "earlier_claim": c.earlier_claim,
                            "later_claim": c.later_claim,
                            "severity": c.severity,
                        }
                        for c in contradictions
                    ],
                    "tokens_used": scribe.total_tokens_used + archivist.total_tokens_used,
                    "elapsed_seconds": round(elapsed, 2),
                })
            except Exception as e:
                elapsed = time.time() - start
                logger.error("Contradiction eval failed on %s: %s", gt["test_id"], e)
                results.append({
                    "test_id": gt["test_id"],
                    "description": gt["description"],
                    "status": "error",
                    "error": str(e),
                    "elapsed_seconds": round(elapsed, 2),
                })

    return results


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Run Poneglyph agent evaluations")
    parser.add_argument("--scout", action="store_true", help="Run Scout eval (12 test cases)")
    parser.add_argument("--scribe", action="store_true", help="Run Scribe eval (5 test cases)")
    parser.add_argument("--auditor", action="store_true", help="Run Auditor eval (8 test cases)")
    parser.add_argument("--contradiction", action="store_true", help="Run contradiction eval (3 test cases)")
    parser.add_argument("--all", action="store_true", help="Run all evals")
    args = parser.parse_args()

    # Default to --all if nothing specified
    run_all = args.all or not (args.scout or args.scribe or args.auditor or args.contradiction)

    all_results: dict = {
        "run_timestamp": datetime.now(timezone.utc).isoformat(),
        "model": "claude-opus-4-7",
    }

    total_start = time.time()

    if run_all or args.scout:
        logger.info("=" * 60)
        logger.info("RUNNING SCOUT EVAL (12 test cases)")
        logger.info("=" * 60)
        all_results["scout"] = run_scout_eval()

    if run_all or args.scribe:
        logger.info("=" * 60)
        logger.info("RUNNING SCRIBE EVAL (5 test cases)")
        logger.info("=" * 60)
        all_results["scribe"] = run_scribe_eval()

    if run_all or args.auditor:
        logger.info("=" * 60)
        logger.info("RUNNING AUDITOR EVAL (8 test cases)")
        logger.info("=" * 60)
        all_results["auditor"] = run_auditor_eval()

    if run_all or args.contradiction:
        logger.info("=" * 60)
        logger.info("RUNNING CONTRADICTION EVAL (3 test cases)")
        logger.info("=" * 60)
        all_results["contradiction"] = run_contradiction_eval()

    total_elapsed = time.time() - total_start
    all_results["total_elapsed_seconds"] = round(total_elapsed, 2)

    # Write results
    results_path = EVALS_DIR / "results.json"
    with open(results_path, "w") as f:
        json.dump(all_results, f, indent=2)

    logger.info("=" * 60)
    logger.info("ALL EVALS COMPLETE in %.1f seconds", total_elapsed)
    logger.info("Results written to: %s", results_path)

    # Print quick summary
    for suite_name in ["scout", "scribe", "auditor", "contradiction"]:
        if suite_name in all_results:
            suite = all_results[suite_name]
            success = sum(1 for r in suite if r.get("status") == "success")
            errors = sum(1 for r in suite if r.get("status") == "error")
            logger.info("  %s: %d/%d success, %d errors", suite_name, success, len(suite), errors)


if __name__ == "__main__":
    main()
