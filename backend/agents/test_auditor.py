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
from memory.models import Confidence, Evidence, EvidenceSource
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

# Synthetic form image for testing Auditor's independent vision verification.
# This is the English attendance form generated in Session 003.
SYNTHETIC_FORM_IMAGE = (
    Path(__file__).resolve().parent.parent.parent
    / "data" / "synthetic" / "form_english.png"
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


def test_vision_verification() -> None:
    """Test: Auditor makes an independent vision call for image-backed evidence.

    Seeds a HIGH-confidence evidence item with source_file pointing to a
    real synthetic form image. With AUDITOR_ALWAYS_VISION_CHECK=True
    (hackathon default), the Auditor should make an independent Opus 4.7
    vision call even for HIGH confidence — demonstrating the capability.

    This test exercises Phase 1 of the Auditor's two-phase verification.
    """
    print("\n" + "=" * 60)
    print("Test: Independent Vision Verification")
    print("=" * 60)

    if not SYNTHETIC_FORM_IMAGE.exists():
        print(f"  SKIPPED: synthetic form image not found at {SYNTHETIC_FORM_IMAGE}")
        return

    with tempfile.TemporaryDirectory() as tmpdir:
        memory = ProjectMemory(data_dir=Path(tmpdir))
        project_id = "mp-fpc-test"
        memory.create_project(project_id, "MP FPC Test", "World Bank")
        memory.load_logframe(project_id, SAMPLE_LOGFRAME)

        # Seed image-backed evidence (as if Scout extracted it)
        evidence = Evidence(
            evidence_id="ev-form-english-001",
            source=EvidenceSource.FIELD_FORM,
            date_collected="2026-02-20",
            district="Sagar",
            village="Gumla",
            logframe_indicator="Output 3.2",
            summary="Attendance sheet showing 47 women attended PHM training session in Gumla village.",
            raw_text="PHM Training Attendance — Gumla Village, 20 Feb 2026. Total: 47 participants.",
            confidence=Confidence.HIGH,
            source_file=str(SYNTHETIC_FORM_IMAGE),
            bounding_boxes=[{"x1": 50, "y1": 100, "x2": 400, "y2": 300}],
        )
        memory.add_evidence(project_id, evidence)
        print(f"  Seeded evidence: {evidence.evidence_id} (confidence: HIGH)")
        print(f"  Source file: {SYNTHETIC_FORM_IMAGE.name}")

        # Construct a draft with a claim citing the image evidence
        draft = DraftSection(
            section_name="Test Vision Verification",
            donor_format="world_bank",
            claims=[
                Claim(
                    text="47 women attended the PHM training session in Gumla village on February 20, 2026.",
                    citation_ids=["ev-form-english-001"],
                    source_type="evidence",
                ),
            ],
            rendered_markdown="(test)",
            gaps=[],
        )

        print(f"  Draft: 1 claim citing image evidence")

        # Run Auditor
        auditor = AuditorAgent(memory=memory)
        print("\n  Running adversarial verification with vision check...")
        verified = auditor.verify(project_id=project_id, draft=draft)

        # Print results
        for i, vc in enumerate(verified.verified_claims):
            tag_symbol = {"verified": "✓", "contested": "⚠", "unsupported": "✗"}
            symbol = tag_symbol.get(vc.tag.value, "?")
            print(f"  [{i}] {symbol} {vc.text[:100]}")
            if vc.reason:
                print(f"      Reason: {vc.reason[:120]}")
            print(f"      Vision check: {vc.used_vision}")

        print(f"\n  Summary: {verified.summary}")

        # ─── Assertions ───────────────────────────────────────

        assert len(verified.verified_claims) == 1, (
            f"Expected 1 verified claim, got {len(verified.verified_claims)}"
        )

        vc = verified.verified_claims[0]

        # Must have used vision — this is the whole point of the test
        assert vc.used_vision, (
            "Expected used_vision=True for image-backed evidence. "
            "Is AUDITOR_ALWAYS_VISION_CHECK set to True?"
        )

        # Any tag is acceptable — the synthetic form image may not match
        # the seeded claim text (and that's fine: the Auditor catching the
        # mismatch is itself a demonstration of the capability). The point
        # of this test is that used_vision=True, not the specific verdict.
        assert vc.tag in (
            VerificationTag.VERIFIED,
            VerificationTag.CONTESTED,
            VerificationTag.UNSUPPORTED,
        ), f"Claim has invalid tag: {vc.tag}"

        print(f"\n  PASSED: Vision verification exercised, tag = {vc.tag.value}")
        if vc.tag == VerificationTag.UNSUPPORTED:
            print("  (Auditor correctly caught mismatch between claim and source image)")


def main() -> None:
    """Run all Auditor tests."""
    print("=" * 60)
    print("Auditor Agent — End-to-End Tests")
    print("=" * 60)

    test_full_pipeline()
    test_unsupported_claim()
    test_vision_verification()

    print("\n" + "=" * 60)
    print("ALL AUDITOR TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
