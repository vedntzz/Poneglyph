"""Pydantic models for the project memory data layer.

Every piece of data in a project binder is stored as a markdown file with
YAML frontmatter (structured fields) and a markdown body (free-form prose
written by agents or humans). These models define the structured fields.

Design decisions:
- snake_case keys in frontmatter for consistency (see CLAUDE.md § Design notes)
- All IDs are strings, not UUIDs — human-readable slugs like "ev-001"
- Timestamps are ISO 8601 strings, not datetime objects, because they
  serialize cleanly to YAML without type coercion issues
- Optional fields use None defaults so partial data is representable
  (field staff often provide incomplete information)
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────

class EvidenceSource(str, Enum):
    """How the evidence was collected. Finite set — no magic strings."""

    FIELD_FORM = "field_form"
    PHOTO = "photo"
    CRM_EXPORT = "crm_export"
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    MEETING_TRANSCRIPT = "meeting_transcript"
    GOVERNMENT_RECORD = "government_record"
    OTHER = "other"


class VerificationStatus(str, Enum):
    """Auditor's verification tag. See CLAUDE.md § demo flow step 9."""

    VERIFIED = "verified"           # ✓ — evidence checks out
    CONTESTED = "contested"         # ⚠ — conflicting evidence exists
    UNVERIFIED = "unverified"       # ✗ — no corroborating evidence
    PENDING = "pending"             # not yet reviewed by Auditor


class Confidence(str, Enum):
    """Scout's confidence in an evidence extraction. See prompts/scout.md § Rule 6."""

    HIGH = "high"       # text clearly legible, meaning unambiguous
    MEDIUM = "medium"   # partially legible or requires inference
    LOW = "low"         # barely legible or speculative


class CommitmentStatus(str, Enum):
    """Lifecycle of a commitment made in a meeting."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    DROPPED = "dropped"


class TimelineEventType(str, Enum):
    """What happened — used for filtering the timeline."""

    EVIDENCE_ADDED = "evidence_added"
    MEETING_LOGGED = "meeting_logged"
    COMMITMENT_MADE = "commitment_made"
    COMMITMENT_UPDATED = "commitment_updated"
    CONTRADICTION_DETECTED = "contradiction_detected"
    LOGFRAME_LOADED = "logframe_loaded"
    PROJECT_CREATED = "project_created"


# ─────────────────────────────────────────────────────────────
# Core models
# ─────────────────────────────────────────────────────────────

class Evidence(BaseModel):
    """A single piece of field evidence extracted by Scout.

    Examples: a scanned beneficiary registration form, a photo of a
    warehouse construction site, a WhatsApp message confirming delivery.
    """

    evidence_id: str = Field(description="Human-readable ID, e.g. 'ev-001'.")
    source: EvidenceSource = Field(description="How this evidence was collected.")
    date_collected: str = Field(description="ISO 8601 date when the evidence was gathered in the field.")
    district: Optional[str] = Field(default=None, description="District where evidence was collected.")
    village: Optional[str] = Field(default=None, description="Village where evidence was collected.")
    logframe_indicator: Optional[str] = Field(
        default=None,
        description="Which logframe target this evidence supports, e.g. 'Output 2.1'.",
    )
    verification_status: VerificationStatus = Field(
        default=VerificationStatus.PENDING,
        description="Auditor's verification tag.",
    )
    summary: str = Field(description="One-line interpreted claim of what this evidence shows.")
    raw_text: Optional[str] = Field(
        default=None,
        description=(
            "Verbatim text extracted from the source image, in the original "
            "language. Separated from summary so Auditor can verify that the "
            "interpretation follows from the literal text."
        ),
    )
    confidence: Optional[Confidence] = Field(
        default=None,
        description="Scout's confidence in this extraction. See prompts/scout.md § Rule 6.",
    )
    source_file: Optional[str] = Field(
        default=None,
        description="Path to the original uploaded file (image, PDF, etc.).",
    )
    bounding_boxes: Optional[list[dict[str, int]]] = Field(
        default=None,
        description=(
            "Pixel-coordinate bounding boxes from Opus 4.7's vision. "
            "Each dict has keys: x1, y1 (top-left corner) and x2, y2 "
            "(bottom-right corner) in the image's native pixel space. "
            "See CAPABILITIES.md#pixel-vision."
        ),
    )


class Meeting(BaseModel):
    """A meeting's extracted decisions and metadata, produced by Scribe.

    Scribe processes audio transcripts or written notes and produces
    structured MoMs (minutes of meetings).
    """

    meeting_id: str = Field(description="Human-readable ID, e.g. 'mtg-001'.")
    date: str = Field(description="ISO 8601 date of the meeting.")
    location: Optional[str] = Field(default=None, description="Where the meeting took place.")
    attendees: list[str] = Field(default_factory=list, description="Names of attendees.")
    agenda: Optional[str] = Field(default=None, description="What the meeting was about.")
    decisions: list[str] = Field(
        default_factory=list,
        description="Concrete decisions made. Each is one sentence.",
    )
    open_questions: list[str] = Field(
        default_factory=list,
        description="Questions raised but not resolved.",
    )
    source_file: Optional[str] = Field(
        default=None,
        description="Path to the original transcript or audio file.",
    )


class Commitment(BaseModel):
    """A tracked commitment — a promise made by someone to do something by a date.

    The Archivist tracks these across meetings. If meeting 4 contradicts
    what was promised in meeting 1, that's a contradiction the system flags.
    """

    commitment_id: str = Field(description="Human-readable ID, e.g. 'cmt-001'.")
    made_in_meeting: str = Field(description="Meeting ID where this commitment was made.")
    owner: str = Field(description="Person or organization responsible.")
    description: str = Field(description="What was promised.")
    due_date: Optional[str] = Field(default=None, description="ISO 8601 date for the deadline.")
    status: CommitmentStatus = Field(
        default=CommitmentStatus.OPEN,
        description="Current status of the commitment.",
    )
    evidence_ids: list[str] = Field(
        default_factory=list,
        description="Evidence IDs that corroborate completion (if any).",
    )


class StakeholderPosition(BaseModel):
    """A stakeholder's stance on a topic at a point in time.

    Stakeholders change positions across meetings. The Archivist tracks
    the evolution so the PM can see who shifted and when.
    """

    stakeholder_id: str = Field(description="Human-readable ID, e.g. 'sh-001'.")
    name: str = Field(description="Stakeholder name or organization.")
    role: Optional[str] = Field(default=None, description="Their role in the project.")
    positions: list[dict[str, str]] = Field(
        default_factory=list,
        description=(
            "Chronological list of positions. Each dict has 'date', "
            "'topic', and 'stance' keys."
        ),
    )


class TimelineEvent(BaseModel):
    """An entry in the project's append-only event log.

    The timeline is the spine of the project binder — a chronological
    record of everything that happened, with references to the source files.
    """

    timestamp: str = Field(description="ISO 8601 datetime when this event was recorded.")
    event_type: TimelineEventType = Field(description="What kind of event this is.")
    summary: str = Field(description="One-line description of the event.")
    references: list[str] = Field(
        default_factory=list,
        description="File paths within the project binder that this event relates to.",
    )
