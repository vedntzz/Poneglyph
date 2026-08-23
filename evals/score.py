"""Score Poneglyph eval results against ground truth.

Reads /evals/results.json (produced by run_all.py) and the ground truth
files, then computes accuracy metrics per agent and per category.

Usage:
  cd backend && uv run python ../evals/score.py

Outputs a summary to stdout and writes /evals/scores.json.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

EVALS_DIR = Path(__file__).resolve().parent


def score_scout(results: list[dict]) -> dict:
    """Score Scout eval results against ground truth.

    Metrics:
    - evidence_count_accuracy: % of test cases where evidence count is within
      the expected min–max range
    - key_fact_recall: for each test case, what fraction of key facts appear
      (keyword match) in any evidence summary or raw_text
    - source_type_accuracy: % of test cases where at least one evidence item
      has the expected source_type
    - bounding_box_validity: % of evidence items with valid bounding boxes
      (all coordinates > 0, x2 > x1, y2 > y1, within 1500x2000)
    """
    gt_path = EVALS_DIR / "scout_eval" / "ground_truth.json"
    with open(gt_path) as f:
        ground_truth = json.load(f)

    # Build lookup by image name
    gt_by_id = {}
    for gt in ground_truth:
        test_id = gt["image"].replace(".png", "")
        gt_by_id[test_id] = gt

    total = 0
    count_in_range = 0
    fact_recalls: list[float] = []
    source_type_matches = 0
    total_bbox = 0
    valid_bbox = 0
    per_category: dict[str, dict] = {}

    for result in results:
        if result.get("status") != "success":
            continue

        test_id = result["test_id"]
        gt = gt_by_id.get(test_id)
        if gt is None:
            continue

        total += 1
        cat = gt["category"]
        if cat not in per_category:
            per_category[cat] = {"total": 0, "count_ok": 0, "fact_recalls": [], "source_ok": 0}
        per_category[cat]["total"] += 1

        # Evidence count in range
        ev_count = result["evidence_count"]
        ev_min = gt["expected_evidence_count"]["min"]
        ev_max = gt["expected_evidence_count"]["max"]
        if ev_min <= ev_count <= ev_max:
            count_in_range += 1
            per_category[cat]["count_ok"] += 1

        # Key fact recall
        all_text = " ".join(
            (ev.get("summary", "") + " " + (ev.get("raw_text", "") or "")).lower()
            for ev in result.get("evidence_items", [])
        )
        matched_facts = 0
        total_facts = len(gt["key_facts"])
        for fact_entry in gt["key_facts"]:
            fact = fact_entry["fact"].lower()
            # Check if key numbers/terms from the fact appear in evidence
            key_terms = _extract_key_terms(fact)
            if all(term in all_text for term in key_terms):
                matched_facts += 1
        recall = matched_facts / total_facts if total_facts > 0 else 1.0
        fact_recalls.append(recall)
        per_category[cat]["fact_recalls"].append(recall)

        # Source type accuracy
        expected_source = gt.get("expected_source_type", "field_form")
        found_source = any(
            ev.get("source_type") == expected_source
            for ev in result.get("evidence_items", [])
        )
        if found_source:
            source_type_matches += 1
            per_category[cat]["source_ok"] += 1

        # Bounding box validity
        for ev in result.get("evidence_items", []):
            for bbox in ev.get("bounding_boxes", []):
                total_bbox += 1
                if (
                    bbox.get("x1", 0) >= 0
                    and bbox.get("y1", 0) >= 0
                    and bbox.get("x2", 0) > bbox.get("x1", 0)
                    and bbox.get("y2", 0) > bbox.get("y1", 0)
                    and bbox.get("x2", 0) <= 1500
                    and bbox.get("y2", 0) <= 2000
                ):
                    valid_bbox += 1

    avg_fact_recall = sum(fact_recalls) / len(fact_recalls) if fact_recalls else 0

    # Per-category summaries
    category_scores = {}
    for cat, data in per_category.items():
        cat_recall = sum(data["fact_recalls"]) / len(data["fact_recalls"]) if data["fact_recalls"] else 0
        category_scores[cat] = {
            "test_cases": data["total"],
            "evidence_count_accuracy": round(data["count_ok"] / data["total"] * 100, 1) if data["total"] else 0,
            "key_fact_recall": round(cat_recall * 100, 1),
            "source_type_accuracy": round(data["source_ok"] / data["total"] * 100, 1) if data["total"] else 0,
        }

    return {
        "test_cases_scored": total,
        "evidence_count_accuracy": round(count_in_range / total * 100, 1) if total else 0,
        "key_fact_recall": round(avg_fact_recall * 100, 1),
        "source_type_accuracy": round(source_type_matches / total * 100, 1) if total else 0,
        "bounding_box_validity": round(valid_bbox / total_bbox * 100, 1) if total_bbox else 0,
        "total_bounding_boxes": total_bbox,
        "per_category": category_scores,
    }


def _extract_key_terms(fact: str) -> list[str]:
    """Extract key terms from a fact string for matching.

    Extracts numbers and significant proper nouns. We look for these in
    the evidence text to determine if the fact was captured.
    """
    import re
    terms = []
    # Extract all numbers (integers, decimals, percentages)
    numbers = re.findall(r'\d+\.?\d*', fact)
    terms.extend(numbers)
    # If no numbers, use first 2 significant words (>3 chars)
    if not numbers:
        words = [w for w in fact.split() if len(w) > 3 and w.isalpha()]
        terms.extend(words[:2])
    return terms


def score_scribe(results: list[dict]) -> dict:
    """Score Scribe eval results.

    Metrics:
    - date_accuracy: exact match on meeting date
    - attendee_recall: fraction of expected attendees found
    - decision_count_in_range: count within min–max
    - commitment_count_in_range: count within min–max
    - required_commitment_recall: fraction of required commitments found
    - open_question_detection: count within range + keyword matches
    """
    gt_path = EVALS_DIR / "scribe_eval" / "ground_truth.json"
    with open(gt_path) as f:
        ground_truth = json.load(f)

    gt_by_id = {}
    for gt in ground_truth:
        test_id = gt["transcript"].replace(".txt", "")
        gt_by_id[test_id] = gt

    total = 0
    date_correct = 0
    attendee_recalls: list[float] = []
    decision_in_range = 0
    commitment_in_range = 0
    required_commitment_recalls: list[float] = []
    oq_in_range = 0

    for result in results:
        if result.get("status") != "success":
            continue
        test_id = result["test_id"]
        gt = gt_by_id.get(test_id)
        if gt is None:
            continue

        total += 1

        # Date accuracy
        if result.get("date") == gt.get("expected_date"):
            date_correct += 1

        # Attendee recall
        if "expected_attendees" in gt:
            expected = [a.lower() for a in gt["expected_attendees"]]
            found = [a.lower() for a in result.get("attendees", [])]
            matched = sum(1 for exp in expected if any(exp in f or f in exp for f in found))
            recall = matched / len(expected) if expected else 1.0
            attendee_recalls.append(recall)
        elif "expected_attendees_must_include" in gt:
            must_include = [a.lower() for a in gt["expected_attendees_must_include"]]
            found = [a.lower() for a in result.get("attendees", [])]
            matched = sum(1 for exp in must_include if any(exp in f or f in exp for f in found))
            recall = matched / len(must_include) if must_include else 1.0
            attendee_recalls.append(recall)

        # Decision count in range
        d_count = result.get("decision_count", 0)
        d_min = gt["expected_decisions"]["min"]
        d_max = gt["expected_decisions"]["max"]
        if d_min <= d_count <= d_max:
            decision_in_range += 1

        # Commitment count in range
        c_count = result.get("commitment_count", 0)
        c_min = gt["expected_commitments"]["min"]
        c_max = gt["expected_commitments"]["max"]
        if c_min <= c_count <= c_max:
            commitment_in_range += 1

        # Required commitment recall
        required = gt["expected_commitments"].get("required", [])
        if required:
            commitments_text = json.dumps(result.get("commitments", []), default=str).lower()
            matched = 0
            for req in required:
                owner_kw = req["owner_contains"].lower()
                desc_kw = req["description_contains"].lower()
                # Check if any commitment matches both keywords
                for cmt in result.get("commitments", []):
                    if (owner_kw in cmt.get("owner", "").lower()
                            and desc_kw in cmt.get("description", "").lower()):
                        matched += 1
                        break
            required_commitment_recalls.append(matched / len(required))

        # Open questions in range
        oq_count = result.get("open_question_count", 0)
        oq_min = gt["expected_open_questions"]["min"]
        oq_max = gt["expected_open_questions"]["max"]
        if oq_min <= oq_count <= oq_max:
            oq_in_range += 1

    avg_attendee_recall = sum(attendee_recalls) / len(attendee_recalls) if attendee_recalls else 0
    avg_req_cmt_recall = sum(required_commitment_recalls) / len(required_commitment_recalls) if required_commitment_recalls else 0

    return {
        "test_cases_scored": total,
        "date_accuracy": round(date_correct / total * 100, 1) if total else 0,
        "attendee_recall": round(avg_attendee_recall * 100, 1),
        "decision_count_in_range": round(decision_in_range / total * 100, 1) if total else 0,
        "commitment_count_in_range": round(commitment_in_range / total * 100, 1) if total else 0,
        "required_commitment_recall": round(avg_req_cmt_recall * 100, 1),
        "open_question_in_range": round(oq_in_range / total * 100, 1) if total else 0,
    }


def score_auditor(results: list[dict]) -> dict:
    """Score Auditor eval results.

    Primary metric: classification accuracy (predicted tag == expected tag).
    Also breaks down by category (should_verify, should_contest, should_unsupport).
    """
    total = 0
    correct = 0
    per_category: dict[str, dict] = {}

    for result in results:
        if result.get("status") != "success":
            continue

        total += 1
        cat = result.get("category", "unknown")
        if cat not in per_category:
            per_category[cat] = {"total": 0, "correct": 0}
        per_category[cat]["total"] += 1

        if result.get("correct", False):
            correct += 1
            per_category[cat]["correct"] += 1

    category_scores = {}
    for cat, data in per_category.items():
        category_scores[cat] = {
            "total": data["total"],
            "correct": data["correct"],
            "accuracy": round(data["correct"] / data["total"] * 100, 1) if data["total"] else 0,
        }

    return {
        "test_cases_scored": total,
        "overall_accuracy": round(correct / total * 100, 1) if total else 0,
        "per_category": category_scores,
    }


def score_contradiction(results: list[dict]) -> dict:
    """Score contradiction detection eval results.

    Metrics:
    - detection_rate: % of test cases where at least 1 contradiction was found
    - keyword_match_rate: % of test cases where found contradictions contain
      the expected keywords
    """
    gt_path = EVALS_DIR / "contradiction_eval" / "ground_truth.json"
    with open(gt_path) as f:
        ground_truth = json.load(f)

    gt_by_id = {gt["test_id"]: gt for gt in ground_truth}

    total = 0
    detected = 0
    keyword_matches = 0

    for result in results:
        if result.get("status") != "success":
            continue
        test_id = result["test_id"]
        gt = gt_by_id.get(test_id)
        if gt is None:
            continue

        total += 1

        # Was any contradiction detected?
        count = result.get("contradiction_count", 0)
        if count > 0:
            detected += 1

        # Do the found contradictions contain expected keywords?
        all_text = " ".join(
            c.get("description", "") + " " + c.get("earlier_claim", "") + " " + c.get("later_claim", "")
            for c in result.get("contradictions", [])
        ).lower()

        required_kw = gt["expected_contradictions"].get("required_keywords", [])
        if required_kw:
            matched = sum(1 for kw in required_kw if kw.lower() in all_text)
            if matched >= len(required_kw) / 2:  # At least half the keywords found
                keyword_matches += 1

    return {
        "test_cases_scored": total,
        "detection_rate": round(detected / total * 100, 1) if total else 0,
        "keyword_match_rate": round(keyword_matches / total * 100, 1) if total else 0,
    }


def main() -> None:
    results_path = EVALS_DIR / "results.json"
    if not results_path.exists():
        print(f"ERROR: {results_path} not found. Run evals/run_all.py first.")
        sys.exit(1)

    with open(results_path) as f:
        results = json.load(f)

    scores: dict = {
        "scored_at": results.get("run_timestamp", "unknown"),
        "model": results.get("model", "unknown"),
    }

    print("=" * 60)
    print("PONEGLYPH EVAL SCORES")
    print("=" * 60)

    if "scout" in results:
        scout_scores = score_scout(results["scout"])
        scores["scout"] = scout_scores
        print(f"\nSCOUT ({scout_scores['test_cases_scored']} test cases)")
        print(f"  Evidence count in expected range: {scout_scores['evidence_count_accuracy']}%")
        print(f"  Key fact recall: {scout_scores['key_fact_recall']}%")
        print(f"  Source type accuracy: {scout_scores['source_type_accuracy']}%")
        print(f"  Bounding box validity: {scout_scores['bounding_box_validity']}% ({scout_scores['total_bounding_boxes']} boxes)")
        if scout_scores.get("per_category"):
            for cat, cat_scores in scout_scores["per_category"].items():
                print(f"    {cat}: count_ok={cat_scores['evidence_count_accuracy']}%, recall={cat_scores['key_fact_recall']}%")

    if "scribe" in results:
        scribe_scores = score_scribe(results["scribe"])
        scores["scribe"] = scribe_scores
        print(f"\nSCRIBE ({scribe_scores['test_cases_scored']} test cases)")
        print(f"  Date accuracy: {scribe_scores['date_accuracy']}%")
        print(f"  Attendee recall: {scribe_scores['attendee_recall']}%")
        print(f"  Decision count in range: {scribe_scores['decision_count_in_range']}%")
        print(f"  Commitment count in range: {scribe_scores['commitment_count_in_range']}%")
        print(f"  Required commitment recall: {scribe_scores['required_commitment_recall']}%")
        print(f"  Open question in range: {scribe_scores['open_question_in_range']}%")

    if "auditor" in results:
        auditor_scores = score_auditor(results["auditor"])
        scores["auditor"] = auditor_scores
        print(f"\nAUDITOR ({auditor_scores['test_cases_scored']} test cases)")
        print(f"  Overall accuracy: {auditor_scores['overall_accuracy']}%")
        if auditor_scores.get("per_category"):
            for cat, cat_scores in auditor_scores["per_category"].items():
                print(f"    {cat}: {cat_scores['correct']}/{cat_scores['total']} ({cat_scores['accuracy']}%)")

    if "contradiction" in results:
        contra_scores = score_contradiction(results["contradiction"])
        scores["contradiction"] = contra_scores
        print(f"\nCONTRADICTION ({contra_scores['test_cases_scored']} test cases)")
        print(f"  Detection rate: {contra_scores['detection_rate']}%")
        print(f"  Keyword match rate: {contra_scores['keyword_match_rate']}%")

    print("\n" + "=" * 60)

    # Write scores
    scores_path = EVALS_DIR / "scores.json"
    with open(scores_path, "w") as f:
        json.dump(scores, f, indent=2)
    print(f"Scores written to: {scores_path}")


if __name__ == "__main__":
    main()
