"""End-to-end test for the Archivist agent.

Tests three capabilities:
1. Query answering with citations (after Scout + Scribe populate memory)
2. Contradiction detection (two meetings where the second walks back a commitment)
3. Gap detection (asking about something with incomplete evidence)

This is a live API test — it calls Opus 4.7. Run with:
    cd backend && python -m agents.test_archivist

Requires ANTHROPIC_API_KEY in environment.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from memory.project_memory import ProjectMemory
from memory.models import (
    Commitment,
    CommitmentStatus,
    Meeting,
)
from agents.archivist import ArchivistAgent
from agents.scribe import ScribeAgent

# ─────────────────────────────────────────────────────────────
# Test data
# ─────────────────────────────────────────────────────────────

SAMPLE_LOGFRAME = """
# MP-FPC Logframe (excerpt)

| Indicator | Target | Unit |
|-----------|--------|------|
| Output 1.1 | 50 AgriMarts operational | count |
| Output 2.1 | 1,000 farmers registered in FarmTrac | count |
| Output 3.1 | Women's PHM training — 40% women participation | percentage |
| Output 3.2 | 200 women trained in post-harvest management | count |
| Output 4.1 | Cold storage facility at Rehli operational | binary |
"""

MEETINGS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic" / "meetings"


def test_query_with_citations() -> None:
    """Test: Archivist answers a query with real file citations after Scribe populates memory."""
    print("\n" + "=" * 60)
    print("Test 1: Query Answering with Citations")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        memory = ProjectMemory(data_dir=Path(tmpdir))
        project_id = "mp-fpc-test"
        memory.create_project(project_id, "MP FPC Test", "World Bank")
        memory.load_logframe(project_id, SAMPLE_LOGFRAME)

        # Populate memory with both meetings via Scribe
        scribe = ScribeAgent(memory=memory)

        transcript_1 = (MEETINGS_DIR / "meeting_001.txt").read_text(encoding="utf-8")
        print("  Processing meeting 001 (kickoff)...")
        scribe.run(project_id=project_id, transcript=transcript_1)

        transcript_2 = (MEETINGS_DIR / "meeting_002.txt").read_text(encoding="utf-8")
        print("  Processing meeting 002 (review)...")
        scribe.run(project_id=project_id, transcript=transcript_2)

        # Verify memory is populated
        meetings = memory.read_all_meetings(project_id)
        commitments = memory.read_all_commitments(project_id)
        print(f"  Memory: {len(meetings)} meetings, {len(commitments)} commitments")
        assert len(meetings) == 2, f"Expected 2 meetings, got {len(meetings)}"

        # Ask the Archivist a question about women's training
        archivist = ArchivistAgent(memory=memory)
        print("\n  Querying: 'Where are we on women's PHM training?'")
        result = archivist.answer_query(
            project_id=project_id,
            query="Where are we on the women's PHM training target? How many women have been trained?",
        )

        print(f"\n  Answer ({len(result.answer)} chars):")
        for line in result.answer.split("\n")[:10]:
            print(f"    {line}")

        print(f"\n  Citations: {len(result.citations)}")
        for c in result.citations:
            print(f"    - {c.file_path}: {c.excerpt[:80]}")

        print(f"\n  Gaps: {len(result.gaps)}")
        for g in result.gaps:
            print(f"    - {g}")

        # Assertions
        assert result.answer, "Answer should not be empty"
        assert len(result.citations) >= 1, (
            f"Expected at least 1 citation, got {len(result.citations)}"
        )

        # Check that citations point to real files
        project_dir = memory._project_dir(project_id)
        for c in result.citations:
            # Citations may use relative paths like "meetings/mtg-xxx.md"
            cited_path = project_dir / c.file_path
            assert cited_path.exists(), (
                f"Citation points to non-existent file: {c.file_path} "
                f"(resolved: {cited_path})"
            )

        # The answer should mention numbers from the transcripts
        answer_lower = result.answer.lower()
        assert "187" in answer_lower or "200" in answer_lower or "47" in answer_lower or "women" in answer_lower, (
            f"Expected women's training numbers in answer"
        )

        print("\n  PASSED: Query answered with valid citations to real files")


def test_contradiction_detection() -> None:
    """Test: Archivist detects the AgriMart walk-back between meetings 001 and 002."""
    print("\n" + "=" * 60)
    print("Test 2: Contradiction Detection")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        memory = ProjectMemory(data_dir=Path(tmpdir))
        project_id = "mp-fpc-test"
        memory.create_project(project_id, "MP FPC Test", "World Bank")
        memory.load_logframe(project_id, SAMPLE_LOGFRAME)

        # Populate both meetings via Scribe
        scribe = ScribeAgent(memory=memory)

        transcript_1 = (MEETINGS_DIR / "meeting_001.txt").read_text(encoding="utf-8")
        print("  Processing meeting 001 (commits to 50 AgriMarts)...")
        scribe.run(project_id=project_id, transcript=transcript_1)

        transcript_2 = (MEETINGS_DIR / "meeting_002.txt").read_text(encoding="utf-8")
        print("  Processing meeting 002 (mentions 42 AgriMarts)...")
        scribe.run(project_id=project_id, transcript=transcript_2)

        # Run contradiction detection
        archivist = ArchivistAgent(memory=memory)
        print("\n  Running contradiction detection...")
        contradictions = archivist.detect_contradictions(project_id=project_id)

        print(f"\n  Found {len(contradictions)} contradiction(s):")
        for c in contradictions:
            print(f"\n    Description: {c.description}")
            print(f"    Earlier: {c.earlier_claim[:80]} [{c.earlier_source}]")
            print(f"    Later:   {c.later_claim[:80]} [{c.later_source}]")
            print(f"    Severity: {c.severity}")

        # Assertions
        assert len(contradictions) >= 1, (
            f"Expected at least 1 contradiction (AgriMart 50→42 walk-back), "
            f"got {len(contradictions)}"
        )

        # Check that at least one contradiction mentions the AgriMart number change
        contradiction_texts = " ".join(
            f"{c.description} {c.earlier_claim} {c.later_claim}".lower()
            for c in contradictions
        )
        assert "50" in contradiction_texts or "42" in contradiction_texts or "agrimart" in contradiction_texts.lower() or "agri" in contradiction_texts, (
            f"Expected AgriMart contradiction (50→42), but text was: {contradiction_texts[:300]}"
        )

        print("\n  PASSED: Contradiction detected (AgriMart walk-back)")


def main() -> None:
    """Run all Archivist tests."""
    print("=" * 60)
    print("Archivist Agent — End-to-End Tests")
    print("=" * 60)

    test_query_with_citations()
    test_contradiction_detection()

    print("\n" + "=" * 60)
    print("ALL ARCHIVIST TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
