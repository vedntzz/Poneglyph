"""End-to-end test for the Auditor agent.

Tests that AuditorAgent re-reads sources independently and assigns
VERIFIED / CONTESTED / UNSUPPORTED tags. Uses the Drafter → Auditor
pipeline on real meeting data.

This is a live API test — it calls Opus 4.7. Run with:
    cd backend && python -m agents.test_auditor

Requires ANTHROPIC_API_KEY in environment.

**Variance note**: Auditor is a judgment task. Run this test 3+ times
and document the spread of ✓/⚠/✗ counts. See sessions/004-scribe-archivist.md
for the variance testing methodology.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from memory.project_memory import ProjectMemory
from agents.scribe import ScribeAgent
from agents.drafter import DrafterAgent, DraftSection, Claim
from agents.auditor import AuditorAgent, VerificationTag, VerifiedClaim


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


def test_full_pipeline() -> None:
    """Test: Drafter → Auditor pipeline produces verified claims with tags.

    Populates memory with two meetings, drafts a section, then verifies it.
    Expected: most claims VERIFIED (source data exists), possibly some
    CONTESTED (numbers may not match perfectly), zero UNSUPPORTED for
    claims that cite real meeting IDs.
    """
    print("\n" + "=" * 60)
    print("Test: Full Drafter → Auditor Pipeline")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        memory = ProjectMemory(data_dir=Path(tmpdir))
        project_id = "mp-fpc-test"
        memory.create_project(project_id, "MP FPC Test", "World Bank")
        memory.load_logframe(project_id, SAMPLE_LOGFRAME)

        # Step 1: Populate memory via Scribe
        scribe = ScribeAgent(memory=memory)

        transcript_1 = (MEETINGS_DIR / "meeting_001.txt").read_text(encoding="utf-8")
        print("  Processing meeting 001 (kickoff)...")
        scribe.run(project_id=project_id, transcript=transcript_1)

        transcript_2 = (MEETINGS_DIR / "meeting_002.txt").read_text(encoding="utf-8")
        print("  Processing meeting 002 (review)...")
        scribe.run(project_id=project_id, transcript=transcript_2)

        meetings = memory.read_all_meetings(project_id)
        commitments = memory.read_all_commitments(project_id)
        print(f"  Memory: {len(meetings)} meetings, {len(commitments)} commitments")

        # Step 2: Draft
        drafter = DrafterAgent(memory=memory)
        print("\n  Drafting section: 'Progress on Women's PHM Training'...")
        draft = drafter.run(
            project_id=project_id,
            section_name="Progress on Women's PHM Training",
            donor_format="world_bank",
        )
        print(f"  Draft: {len(draft.claims)} claims, {len(draft.gaps)} gaps")

        # Step 3: Verify
        auditor = AuditorAgent(memory=memory)
        print("\n  Running adversarial verification...")
        verified = auditor.verify(
            project_id=project_id,
            draft=draft,
        )

        # ─── Print results ────────────────────────────────────
        verified_count = sum(
            1 for vc in verified.verified_claims
            if vc.tag == VerificationTag.VERIFIED
        )
        contested_count = sum(
            1 for vc in verified.verified_claims
            if vc.tag == VerificationTag.CONTESTED
        )
        unsupported_count = sum(
            1 for vc in verified.verified_claims
            if vc.tag == VerificationTag.UNSUPPORTED
        )
        vision_count = sum(1 for vc in verified.verified_claims if vc.used_vision)

        print(f"\n--- Verification Results ---")
        print(f"  Total claims: {len(verified.verified_claims)}")
        print(f"  ✓ Verified:    {verified_count}")
        print(f"  ⚠ Contested:   {contested_count}")
        print(f"  ✗ Unsupported: {unsupported_count}")
        print(f"  Vision calls:  {vision_count}")
        print(f"  Summary: {verified.summary}")

        print(f"\n--- Per-claim Details ---")
        for i, vc in enumerate(verified.verified_claims):
            tag_symbol = {"verified": "✓", "contested": "⚠", "unsupported": "✗"}
            symbol = tag_symbol.get(vc.tag.value, "?")
            citations = ", ".join(vc.citation_ids) if vc.citation_ids else "none"
            print(f"  [{i}] {symbol} [{citations}]")
            print(f"      {vc.text[:120]}")
            if vc.reason:
                print(f"      Reason: {vc.reason[:120]}")
            if vc.used_vision:
                print(f"      (independent vision check)")

        # ─── Assertions ───────────────────────────────────────

        # Must have the same number of verified claims as draft claims
        assert len(verified.verified_claims) == len(draft.claims), (
            f"Auditor returned {len(verified.verified_claims)} verified claims "
            f"but draft had {len(draft.claims)} claims"
        )

        # Every claim must have a tag
        for i, vc in enumerate(verified.verified_claims):
            assert vc.tag in (
                VerificationTag.VERIFIED,
                VerificationTag.CONTESTED,
                VerificationTag.UNSUPPORTED,
            ), f"Claim {i} has invalid tag: {vc.tag}"

        # CONTESTED and UNSUPPORTED must have a reason
        for i, vc in enumerate(verified.verified_claims):
            if vc.tag in (VerificationTag.CONTESTED, VerificationTag.UNSUPPORTED):
                assert vc.reason, (
                    f"Claim {i} tagged {vc.tag.value} but has no reason"
                )

        # At least some claims should be VERIFIED — we have real data backing them
        assert verified_count >= 1, (
            f"Expected at least 1 VERIFIED claim, got 0. "
            f"All tags: {[vc.tag.value for vc in verified.verified_claims]}"
        )

        # Summary should be populated
        assert verified.summary, "Verification summary should not be empty"
        assert "verified" in verified.summary.lower() or "✓" in verified.summary, (
            f"Summary should mention verification counts: {verified.summary}"
        )

        # No vision calls expected (test data is text-only, no image evidence)
        # This assertion documents the expected behavior — image-sourced evidence
        # would trigger vision calls per Phase 1 in auditor.py.
        assert vision_count == 0, (
            f"Expected 0 vision calls (text-only test data), got {vision_count}"
        )

        print(f"\n  PASSED: {len(verified.verified_claims)} claims verified "
              f"({verified_count}✓ {contested_count}⚠ {unsupported_count}✗)")


def test_unsupported_claim() -> None:
    """Test: Auditor tags a fabricated claim as UNSUPPORTED.

    Manually constructs a DraftSection with one valid claim citing a real
    meeting and one claim citing a nonexistent evidence ID. Verifies the
    Auditor correctly distinguishes them.
    """
    print("\n" + "=" * 60)
    print("Test: Fabricated Claim Detection")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        memory = ProjectMemory(data_dir=Path(tmpdir))
        project_id = "mp-fpc-test"
        memory.create_project(project_id, "MP FPC Test", "World Bank")
        memory.load_logframe(project_id, SAMPLE_LOGFRAME)

        # Populate one meeting so there's a real source to cite
        scribe = ScribeAgent(memory=memory)
        transcript_1 = (MEETINGS_DIR / "meeting_001.txt").read_text(encoding="utf-8")
        print("  Processing meeting 001...")
        scribe.run(project_id=project_id, transcript=transcript_1)

        meetings = memory.read_all_meetings(project_id)
        assert len(meetings) == 1
        real_meeting_id = meetings[0].meeting_id

        # Construct a draft with one real claim and one fabricated claim
        draft = DraftSection(
            section_name="Test Section",
            donor_format="world_bank",
            claims=[
                Claim(
                    text=(
                        f"The project kickoff meeting established a target of "
                        f"50 AgriMarts by Q3 2026."
                    ),
                    citation_ids=[real_meeting_id],
                    source_type="meeting",
                ),
                Claim(
                    text="500 cold storage units have been installed across 12 districts.",
                    citation_ids=["ev-nonexistent-999"],
                    source_type="evidence",
                ),
            ],
            rendered_markdown="(test)",
            gaps=[],
        )

        print(f"  Draft: 2 claims (1 real, 1 fabricated)")
        print(f"  Real claim cites: {real_meeting_id}")
        print(f"  Fabricated claim cites: ev-nonexistent-999")

        # Run Auditor
        auditor = AuditorAgent(memory=memory)
        print("\n  Running adversarial verification...")
        verified = auditor.verify(project_id=project_id, draft=draft)

        # Print results
        for i, vc in enumerate(verified.verified_claims):
            tag_symbol = {"verified": "✓", "contested": "⚠", "unsupported": "✗"}
            symbol = tag_symbol.get(vc.tag.value, "?")
            print(f"  [{i}] {symbol} {vc.text[:80]}")
            if vc.reason:
                print(f"      Reason: {vc.reason[:120]}")

        # ─── Assertions ───────────────────────────────────────

        assert len(verified.verified_claims) == 2, (
            f"Expected 2 verified claims, got {len(verified.verified_claims)}"
        )

        # The fabricated claim (index 1) must be UNSUPPORTED — the cited
        # evidence file doesn't exist
        fabricated = verified.verified_claims[1]
        assert fabricated.tag == VerificationTag.UNSUPPORTED, (
            f"Fabricated claim should be UNSUPPORTED, got {fabricated.tag.value}. "
            f"Reason: {fabricated.reason}"
        )
        assert fabricated.reason, "UNSUPPORTED claim should have a reason"

        # The real claim (index 0) should be VERIFIED or CONTESTED
        # (CONTESTED is acceptable if the model interprets the 50 target
        # slightly differently)
        real_claim = verified.verified_claims[0]
        assert real_claim.tag in (VerificationTag.VERIFIED, VerificationTag.CONTESTED), (
            f"Real claim should be VERIFIED or CONTESTED, got {real_claim.tag.value}. "
            f"Reason: {real_claim.reason}"
        )

        print(f"\n  PASSED: Real claim = {real_claim.tag.value}, "
              f"Fabricated claim = {fabricated.tag.value}")


def main() -> None:
    """Run all Auditor tests."""
    print("=" * 60)
    print("Auditor Agent — End-to-End Tests")
    print("=" * 60)

    test_full_pipeline()
    test_unsupported_claim()

    print("\n" + "=" * 60)
    print("ALL AUDITOR TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
