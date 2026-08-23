"""End-to-end test for the Scribe agent.

Tests that ScribeAgent correctly extracts commitments, decisions, and
open questions from a meeting transcript, and persists them to ProjectMemory.

This is a live API test — it calls Opus 4.7. Run with:
    cd backend && python -m agents.test_scribe

Requires ANTHROPIC_API_KEY in environment.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from memory.project_memory import ProjectMemory
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

SAMPLE_TRANSCRIPT = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic" / "meetings" / "meeting_001.txt"


def main() -> None:
    """Run the Scribe end-to-end test."""
    print("=" * 60)
    print("Scribe Agent — End-to-End Test")
    print("=" * 60)

    # Set up a temp directory for ProjectMemory
    with tempfile.TemporaryDirectory() as tmpdir:
        memory = ProjectMemory(data_dir=Path(tmpdir))

        # Create the project and load logframe
        project_id = "mp-fpc-test"
        memory.create_project(project_id, "MP FPC Test", "World Bank")
        memory.load_logframe(project_id, SAMPLE_LOGFRAME)

        # Read the sample transcript
        transcript = SAMPLE_TRANSCRIPT.read_text(encoding="utf-8")
        print(f"\nTranscript: {len(transcript)} chars from {SAMPLE_TRANSCRIPT.name}")

        # Run Scribe
        scribe = ScribeAgent(memory=memory)
        record = scribe.run(
            project_id=project_id,
            transcript=transcript,
            source_file_path=str(SAMPLE_TRANSCRIPT),
        )

        # ─── Assertions ────────────────────────────────────────
        print(f"\n--- Results ---")
        print(f"Date: {record.date}")
        print(f"Attendees: {len(record.attendees)}")
        print(f"Decisions: {len(record.decisions)}")
        print(f"Commitments: {len(record.commitments)}")
        print(f"Open questions: {len(record.open_questions)}")
        print(f"Disagreements: {len(record.disagreements)}")

        # Basic structure checks
        assert record.date, "Meeting date should be extracted"
        assert len(record.attendees) >= 4, (
            f"Expected at least 4 attendees, got {len(record.attendees)}"
        )
        assert len(record.decisions) >= 1, (
            f"Expected at least 1 decision, got {len(record.decisions)}"
        )
        assert len(record.commitments) >= 3, (
            f"Expected at least 3 commitments (AgriMarts, training materials, "
            f"women's training), got {len(record.commitments)}"
        )
        assert record.full_mom_markdown, "MoM markdown should not be empty"

        # Check that commitments have owners and descriptions
        for c in record.commitments:
            assert c.owner, f"Commitment missing owner: {c.description[:50]}"
            assert c.description, f"Commitment missing description"
            print(f"  Commitment: {c.owner} — {c.description[:60]} (due: {c.due_date})")

        # Check key commitment content — the transcript mentions:
        # - 50 AgriMarts by Q3 (Ankit)
        # - Training materials by May 15 (Meena)
        # - 200 women trained by end of March (Meena)
        commitment_texts = " ".join(
            f"{c.owner} {c.description}".lower() for c in record.commitments
        )
        assert "agrimart" in commitment_texts or "agri-mart" in commitment_texts or "agri mart" in commitment_texts or "50" in commitment_texts, (
            f"Expected AgriMart commitment in: {commitment_texts[:200]}"
        )
        assert "training material" in commitment_texts or "may 15" in commitment_texts or "may" in commitment_texts, (
            f"Expected training materials commitment in: {commitment_texts[:200]}"
        )

        # Verify persistence to ProjectMemory
        meetings = memory.read_all_meetings(project_id)
        assert len(meetings) == 1, f"Expected 1 meeting in memory, got {len(meetings)}"

        commitments = memory.read_all_commitments(project_id)
        assert len(commitments) >= 3, (
            f"Expected at least 3 commitments in memory, got {len(commitments)}"
        )

        # Verify files exist on disk
        project_dir = memory._project_dir(project_id)
        meeting_files = list((project_dir / "meetings").glob("*.md"))
        commitment_files = list((project_dir / "commitments").glob("*.md"))
        assert len(meeting_files) == 1, f"Expected 1 meeting file, got {len(meeting_files)}"
        assert len(commitment_files) >= 3, (
            f"Expected at least 3 commitment files, got {len(commitment_files)}"
        )

        print(f"\nMemory files created:")
        print(f"  Meetings: {len(meeting_files)}")
        print(f"  Commitments: {len(commitment_files)}")

        # Print the MoM
        print(f"\n--- Minutes of Meeting (excerpt) ---")
        mom_lines = record.full_mom_markdown.split("\n")
        for line in mom_lines[:30]:
            print(f"  {line}")
        if len(mom_lines) > 30:
            print(f"  ... ({len(mom_lines) - 30} more lines)")

        print(f"\n{'=' * 60}")
        print("ALL ASSERTIONS PASSED")
        print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
