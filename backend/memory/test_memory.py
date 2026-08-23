"""End-to-end test for the ProjectMemory class.

Creates a project, adds 3 evidence items, 2 meetings, 1 commitment,
reads them all back, and prints the timeline. This validates the full
read/write cycle of the file-system-based project binder.

Run: cd backend && uv run python -m memory.test_memory
Or:  cd backend && uv run python memory/test_memory.py
"""

from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path

# Allow running from the repo root or the backend directory
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from memory.models import (
    Commitment,
    CommitmentStatus,
    Evidence,
    EvidenceSource,
    Meeting,
    VerificationStatus,
)
from memory.project_memory import ProjectMemory


def run_test() -> None:
    """Run the full end-to-end test."""

    # Use a temp directory so tests don't pollute the real data dir
    tmp_dir = Path(tempfile.mkdtemp(prefix="poneglyph_test_"))
    print(f"Test data directory: {tmp_dir}\n")

    try:
        memory = ProjectMemory(data_dir=tmp_dir)

        # ─── 1. Create project ───────────────────────────────
        print("=" * 60)
        print("1. Creating project 'mp-fpc-2024'")
        print("=" * 60)

        project_dir = memory.create_project(
            project_id="mp-fpc-2024",
            name="Madhya Pradesh Farmer Producer Company Support",
            donor="World Bank",
        )
        print(f"   Created at: {project_dir}")

        # ─── 2. Load logframe ────────────────────────────────
        print("\n2. Loading logframe")

        logframe_text = """## Output 1: Farmer Producer Companies Established

| Indicator | Target | Unit |
|-----------|--------|------|
| 1.1 FPCs registered | 15 | FPCs |
| 1.2 Farmers enrolled | 10,000 | farmers |
| 1.3 Women farmer participation | 30% | percentage |

## Output 2: Infrastructure Development

| Indicator | Target | Unit |
|-----------|--------|------|
| 2.1 Cold storage facilities | 5 | facilities |
| 2.2 Sale points operational | 20 | sale points |

## Output 3: Capacity Building

| Indicator | Target | Unit |
|-----------|--------|------|
| 3.1 PHM trainings conducted | 50 | trainings |
| 3.2 Women's PHM trainings | 20 | trainings |
| 3.3 Stakeholders trained | 1,000 | people |
"""
        memory.load_logframe("mp-fpc-2024", logframe_text)
        print("   Logframe written")

        # ─── 3. Add evidence ─────────────────────────────────
        print("\n3. Adding 3 evidence items")

        evidence_items = [
            Evidence(
                evidence_id="ev-001",
                source=EvidenceSource.FIELD_FORM,
                date_collected="2024-11-15",
                district="Sagar",
                village="Rahatgarh",
                logframe_indicator="Output 1.2",
                verification_status=VerificationStatus.VERIFIED,
                summary="Beneficiary registration form: 47 farmers enrolled in Rahatgarh village, Sagar district. Form signed by Village Development Officer.",
                source_file="data/real_redacted/sagar_registration_nov15.pdf",
                bounding_boxes=[
                    {"x": 120, "y": 340, "width": 680, "height": 45},
                    {"x": 120, "y": 890, "width": 680, "height": 45},
                ],
            ),
            Evidence(
                evidence_id="ev-002",
                source=EvidenceSource.PHOTO,
                date_collected="2024-12-03",
                district="Sagar",
                logframe_indicator="Output 2.1",
                verification_status=VerificationStatus.PENDING,
                summary="Photo of cold storage construction at Sagar district hub. Foundation laid, walls at 40% completion. Contractor signboard visible.",
                source_file="data/real_redacted/sagar_cold_storage_dec03.jpg",
            ),
            Evidence(
                evidence_id="ev-003",
                source=EvidenceSource.WHATSAPP,
                date_collected="2024-12-10",
                district="Damoh",
                village="Hatta",
                logframe_indicator="Output 3.2",
                verification_status=VerificationStatus.CONTESTED,
                summary="WhatsApp message from field coordinator: 'Women's PHM training completed in Hatta, 32 participants.' But no attendance sheet attached — verification pending.",
            ),
        ]

        for ev in evidence_items:
            eid = memory.add_evidence("mp-fpc-2024", ev)
            print(f"   Added: {eid} — {ev.summary[:60]}...")

        # ─── 4. Add meetings ─────────────────────────────────
        print("\n4. Adding 2 meetings")

        meeting_1 = Meeting(
            meeting_id="mtg-001",
            date="2024-10-20",
            location="District Collector's Office, Sagar",
            attendees=[
                "District Collector (Sagar)",
                "Project Director (Synergy)",
                "Block Development Officer (Rahatgarh)",
                "FPC Chairperson (Sagar FPC)",
            ],
            agenda="Q1 progress review and infrastructure timeline",
            decisions=[
                "Cold storage construction in Sagar to begin by November 15",
                "FPC registration target increased from 12 to 15 based on demand",
                "Weekly WhatsApp updates from each block coordinator",
            ],
            open_questions=[
                "Land allotment for Damoh sale point still pending with revenue department",
            ],
            source_file="data/real_redacted/sagar_review_oct20_transcript.txt",
        )

        meeting_2 = Meeting(
            meeting_id="mtg-002",
            date="2024-12-15",
            location="Block Office, Hatta, Damoh",
            attendees=[
                "Block Development Officer (Hatta)",
                "Field Coordinator (Damoh)",
                "Women's SHG representative",
                "Project Manager (Synergy)",
            ],
            agenda="Women's capacity building progress and Q2 planning",
            decisions=[
                "Next women's PHM training scheduled for January 10 in Hatta",
                "Field coordinator to collect attendance sheets for all past trainings within 1 week",
                "SHG representative to identify 50 additional women farmers for enrollment",
            ],
            open_questions=[
                "Whether women's PHM training in Hatta (Dec 10) actually had 32 participants — no attendance sheet",
                "Budget reallocation for additional training materials",
            ],
        )

        for mtg in [meeting_1, meeting_2]:
            mid = memory.add_meeting(
                "mp-fpc-2024",
                mtg,
                body=f"## Minutes of Meeting\n\nMeeting held at {mtg.location} on {mtg.date}.\n\nSee decisions and open questions in frontmatter above.",
            )
            print(f"   Added: {mid} — {mtg.agenda}")

        # ─── 5. Add commitment ───────────────────────────────
        print("\n5. Adding 1 commitment")

        commitment = Commitment(
            commitment_id="cmt-001",
            made_in_meeting="mtg-002",
            owner="Field Coordinator (Damoh)",
            description="Collect attendance sheets for all past women's PHM trainings in Damoh district",
            due_date="2024-12-22",
            status=CommitmentStatus.OPEN,
        )

        cid = memory.add_commitment(
            "mp-fpc-2024",
            commitment,
            body="This is critical for verifying ev-003 (WhatsApp claim of 32 participants). Without attendance sheets, the Auditor cannot verify the training count for the Q2 report.",
        )
        print(f"   Added: {cid} — {commitment.description[:60]}...")

        # ─── 6. Read everything back ─────────────────────────
        print("\n" + "=" * 60)
        print("6. Reading everything back")
        print("=" * 60)

        all_evidence = memory.read_all_evidence("mp-fpc-2024")
        print(f"\n   Evidence items: {len(all_evidence)}")
        for ev in all_evidence:
            print(f"     [{ev.verification_status.value:>10}] {ev.evidence_id}: {ev.summary[:70]}...")

        all_meetings = memory.read_all_meetings("mp-fpc-2024")
        print(f"\n   Meetings: {len(all_meetings)}")
        for mtg in all_meetings:
            print(f"     {mtg.meeting_id}: {mtg.agenda} ({len(mtg.decisions)} decisions)")

        all_commitments = memory.read_all_commitments("mp-fpc-2024")
        print(f"\n   Commitments: {len(all_commitments)}")
        for cmt in all_commitments:
            print(f"     [{cmt.status.value:>11}] {cmt.commitment_id}: {cmt.description[:60]}...")

        # ─── 7. Read and print timeline ──────────────────────
        print("\n" + "=" * 60)
        print("7. Timeline")
        print("=" * 60)

        timeline = memory.read_timeline("mp-fpc-2024")
        print(f"\n   Total events: {len(timeline)}\n")
        for event in timeline:
            print(f"   [{event.event_type.value:>25}] {event.summary}")
            if event.references:
                print(f"   {'':>27} refs: {', '.join(event.references)}")

        # ─── 8. Test contradiction stub ──────────────────────
        print("\n" + "=" * 60)
        print("8. Contradiction detection (stub)")
        print("=" * 60)

        contradictions = memory.find_contradictions("mp-fpc-2024")
        print(f"\n   Contradictions found: {len(contradictions)} (stub — always returns [])")

        # ─── 9. Verify file structure ────────────────────────
        print("\n" + "=" * 60)
        print("9. File structure on disk")
        print("=" * 60)

        project_dir = tmp_dir / "mp-fpc-2024"
        for path in sorted(project_dir.rglob("*")):
            if path.is_file():
                relative = path.relative_to(tmp_dir)
                size = path.stat().st_size
                print(f"   {relative}  ({size} bytes)")

        # ─── Assertions ──────────────────────────────────────
        print("\n" + "=" * 60)
        print("ASSERTIONS")
        print("=" * 60)

        assert len(all_evidence) == 3, f"Expected 3 evidence, got {len(all_evidence)}"
        assert len(all_meetings) == 2, f"Expected 2 meetings, got {len(all_meetings)}"
        assert len(all_commitments) == 1, f"Expected 1 commitment, got {len(all_commitments)}"
        assert len(timeline) >= 8, f"Expected >= 8 timeline events, got {len(timeline)}"
        assert contradictions == [], f"Stub should return [], got {contradictions}"

        # Verify round-trip data integrity
        assert all_evidence[0].evidence_id == "ev-001"
        assert all_evidence[0].source == EvidenceSource.FIELD_FORM
        assert all_evidence[0].district == "Sagar"
        assert all_evidence[0].bounding_boxes is not None
        assert len(all_evidence[0].bounding_boxes) == 2

        assert all_evidence[2].verification_status == VerificationStatus.CONTESTED

        assert all_meetings[0].meeting_id == "mtg-001"
        assert len(all_meetings[0].decisions) == 3
        assert len(all_meetings[1].open_questions) == 2

        assert all_commitments[0].status == CommitmentStatus.OPEN
        assert all_commitments[0].made_in_meeting == "mtg-002"

        print("\n   ALL ASSERTIONS PASSED ✓")

    finally:
        # Clean up temp directory
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(f"\n   Cleaned up: {tmp_dir}")


if __name__ == "__main__":
    run_test()
