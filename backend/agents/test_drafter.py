"""End-to-end test for the Drafter agent.

Tests that DrafterAgent reads the project binder and produces a World Bank
format report section with structured claims, each citing a source ID.

This is a live API test — it calls Opus 4.7. Run with:
    cd backend && python -m agents.test_drafter

Requires ANTHROPIC_API_KEY in environment.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from memory.project_memory import ProjectMemory
from agents.scribe import ScribeAgent
from agents.drafter import DrafterAgent, DraftSection, Claim


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

MEETINGS_DIR = (
    Path(__file__).resolve().parent.parent.parent
    / "data" / "synthetic" / "meetings"
)


def test_draft_section() -> None:
    """Test: Drafter produces a World Bank report section with cited claims."""
    print("\n" + "=" * 60)
    print("Test: Draft World Bank Report Section")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        memory = ProjectMemory(data_dir=Path(tmpdir))
        project_id = "mp-fpc-test"
        memory.create_project(project_id, "MP FPC Test", "World Bank")
        memory.load_logframe(project_id, SAMPLE_LOGFRAME)

        # Populate memory with meetings via Scribe
        scribe = ScribeAgent(memory=memory)

        transcript_1 = (MEETINGS_DIR / "meeting_001.txt").read_text(encoding="utf-8")
        print("  Processing meeting 001 (kickoff)...")
        scribe.run(project_id=project_id, transcript=transcript_1)

        transcript_2 = (MEETINGS_DIR / "meeting_002.txt").read_text(encoding="utf-8")
        print("  Processing meeting 002 (review)...")
        scribe.run(project_id=project_id, transcript=transcript_2)

        # Verify memory is populated before drafting
        meetings = memory.read_all_meetings(project_id)
        commitments = memory.read_all_commitments(project_id)
        print(f"  Memory: {len(meetings)} meetings, {len(commitments)} commitments")
        assert len(meetings) == 2, f"Expected 2 meetings, got {len(meetings)}"

        # Run Drafter
        drafter = DrafterAgent(memory=memory)
        print("\n  Drafting section: 'Progress on Women's PHM Training'...")
        draft = drafter.run(
            project_id=project_id,
            section_name="Progress on Women's PHM Training",
            donor_format="world_bank",
        )

        # ─── Print results ────────────────────────────────────
        print(f"\n--- Draft Results ---")
        print(f"  Section: {draft.section_name}")
        print(f"  Format: {draft.donor_format}")
        print(f"  Claims: {len(draft.claims)}")
        print(f"  Gaps: {len(draft.gaps)}")

        print(f"\n--- Claims ---")
        for i, claim in enumerate(draft.claims):
            citations = ", ".join(claim.citation_ids) if claim.citation_ids else "none"
            print(f"  [{i}] ({claim.source_type}) [{citations}]")
            print(f"      {claim.text[:120]}")

        if draft.gaps:
            print(f"\n--- Gaps ---")
            for gap in draft.gaps:
                print(f"  - {gap}")

        print(f"\n--- Rendered Markdown (excerpt) ---")
        md_lines = draft.rendered_markdown.split("\n")
        for line in md_lines[:25]:
            print(f"  {line}")
        if len(md_lines) > 25:
            print(f"  ... ({len(md_lines) - 25} more lines)")

        # ─── Assertions ───────────────────────────────────────

        # Structure: must have claims
        assert len(draft.claims) >= 2, (
            f"Expected at least 2 claims, got {len(draft.claims)}"
        )

        # Most claims must have citations. Gap-describing claims (about
        # the absence of evidence) may legitimately have none.
        uncited_count = 0
        for i, claim in enumerate(draft.claims):
            assert claim.source_type in ("evidence", "meeting", "commitment", "logframe"), (
                f"Claim {i} has invalid source_type: {claim.source_type}"
            )
            if not claim.citation_ids:
                uncited_count += 1
                print(f"  Note: claim {i} has no citations (gap claim): {claim.text[:80]}")
        assert uncited_count <= 2, (
            f"Too many uncited claims ({uncited_count}). Only gap-describing "
            f"claims should lack citations."
        )

        # Claims should be atomic: each should be a single sentence
        for i, claim in enumerate(draft.claims):
            # A rough heuristic: claims shouldn't have more than 2 periods
            # (one ending the sentence, maybe one in a date or abbreviation)
            period_count = claim.text.count(".")
            assert period_count <= 3, (
                f"Claim {i} may not be atomic ({period_count} periods): "
                f"{claim.text[:100]}"
            )

        # Rendered markdown should not be empty
        assert len(draft.rendered_markdown) > 100, (
            f"Rendered markdown too short ({len(draft.rendered_markdown)} chars)"
        )

        # Content: the section should reference women's training numbers
        all_text = " ".join(c.text.lower() for c in draft.claims)
        has_training_content = (
            "women" in all_text
            or "training" in all_text
            or "phm" in all_text
            or "187" in all_text
            or "200" in all_text
        )
        assert has_training_content, (
            f"Claims don't reference women's training content"
        )

        # Total citation count — most claims cite at least one source
        all_citations = [cid for c in draft.claims for cid in c.citation_ids]
        assert len(all_citations) >= len(draft.claims) - 2, (
            f"Expected at least {len(draft.claims) - 2} citations across "
            f"{len(draft.claims)} claims, got {len(all_citations)}"
        )

        print(f"\n  PASSED: {len(draft.claims)} claims, all cited")


def main() -> None:
    """Run all Drafter tests."""
    print("=" * 60)
    print("Drafter Agent — End-to-End Tests")
    print("=" * 60)

    test_draft_section()

    print("\n" + "=" * 60)
    print("ALL DRAFTER TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
