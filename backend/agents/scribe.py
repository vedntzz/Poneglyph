"""Scribe agent — extracts structured meeting intelligence from transcripts.

Takes a raw meeting transcript and produces a structured MeetingRecord with
decisions, commitments (who promised what by when), open questions, and
disagreements. Writes results to ProjectMemory so the Archivist can track
commitments across sessions and detect contradictions.

Key design decisions:
- Tool-forced output: same pattern as Scout — we define a `record_meeting`
  tool and force its use for reliable structured output.
- Single LLM call: meetings are text-only, so the full transcript fits in
  context. No need for multi-turn or agentic loops.
- Commitment extraction is the critical path: every commitment gets a
  unique ID, an owner, and a deadline so the Archivist can track it.

See CAPABILITIES.md#adaptive-thinking, prompts/scribe.md.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Literal

import anthropic
from pydantic import BaseModel, Field

from memory.models import (
    Commitment,
    CommitmentStatus,
    Meeting,
    TimelineEvent,
    TimelineEventType,
)
from memory.project_memory import ProjectMemory

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MODEL = "claude-opus-4-7"

# Scribe's output can be verbose (full MoM markdown + structured data),
# so we allow more tokens than Scout.
MAX_OUTPUT_TOKENS = 12_000


# ─────────────────────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────────────────────

class ExtractedCommitment(BaseModel):
    """A commitment extracted from a meeting transcript."""

    owner: str = Field(description="Person who made the commitment (full name).")
    description: str = Field(description="What was promised, as a specific deliverable.")
    due_date: str | None = Field(
        default=None,
        description="ISO 8601 deadline. Null if no deadline stated.",
    )
    logframe_indicator: str | None = Field(
        default=None,
        description="Logframe indicator this commitment relates to, if any.",
    )


class Disagreement(BaseModel):
    """A disagreement or tension between attendees."""

    parties: list[str] = Field(description="Names of people who disagreed.")
    topic: str = Field(description="What the disagreement was about.")
    resolution: str | None = Field(
        default=None,
        description="How it was resolved, if at all. Null if unresolved.",
    )


class MeetingRecord(BaseModel):
    """Full structured output from Scribe's meeting analysis.

    Contains both structured fields (for programmatic use by Archivist,
    Drafter) and a human-readable MoM markdown (for the project binder).
    """

    date: str = Field(description="Meeting date in ISO 8601 format.")
    location: str | None = Field(default=None, description="Meeting location.")
    attendees: list[str] = Field(description="Full names of attendees.")
    decisions: list[str] = Field(description="Concrete decisions agreed upon.")
    commitments: list[ExtractedCommitment] = Field(
        description="Tracked commitments with owners and deadlines.",
    )
    open_questions: list[str] = Field(
        description="Questions raised but not resolved.",
    )
    disagreements: list[Disagreement] = Field(
        default_factory=list,
        description="Tensions or disagreements between attendees.",
    )
    full_mom_markdown: str = Field(
        description="Complete Minutes of Meeting as markdown, readable standalone.",
    )
    notes: str | None = Field(
        default=None,
        description="Any issues with the transcript: ambiguities, missing info.",
    )


# ─────────────────────────────────────────────────────────────
# Tool definition — forces structured output from Opus 4.7
# ─────────────────────────────────────────────────────────────

# Same pattern as Scout: force tool use for reliable structured output.
# See prompts/scribe.md § Rule 1.
RECORD_MEETING_TOOL: dict[str, Any] = {
    "name": "record_meeting",
    "description": (
        "Record the full structured analysis of a meeting transcript. "
        "Call this exactly once per transcript with all extracted data."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": "Meeting date in ISO 8601 format (YYYY-MM-DD).",
            },
            "location": {
                "type": ["string", "null"],
                "description": "Where the meeting took place.",
            },
            "attendees": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Full names of all attendees.",
            },
            "decisions": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "Concrete decisions agreed upon in the meeting. "
                    "Only include things explicitly decided, not discussed."
                ),
            },
            "commitments": {
                "type": "array",
                "description": "Commitments with owners and deadlines.",
                "items": {
                    "type": "object",
                    "properties": {
                        "owner": {
                            "type": "string",
                            "description": "Person who made the commitment (full name).",
                        },
                        "description": {
                            "type": "string",
                            "description": "What was promised, stated as a deliverable.",
                        },
                        "due_date": {
                            "type": ["string", "null"],
                            "description": (
                                "ISO 8601 deadline. Resolve relative dates "
                                "using the meeting date. Null if unstated."
                            ),
                        },
                        "logframe_indicator": {
                            "type": ["string", "null"],
                            "description": (
                                "Logframe indicator this relates to, if any. "
                                "Use the indicator ID exactly as in the logframe."
                            ),
                        },
                    },
                    "required": ["owner", "description"],
                },
            },
            "open_questions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Questions raised but not answered in the meeting.",
            },
            "disagreements": {
                "type": "array",
                "description": "Disagreements or tensions between attendees.",
                "items": {
                    "type": "object",
                    "properties": {
                        "parties": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Names of people who disagreed.",
                        },
                        "topic": {
                            "type": "string",
                            "description": "What the disagreement was about.",
                        },
                        "resolution": {
                            "type": ["string", "null"],
                            "description": "How it was resolved. Null if unresolved.",
                        },
                    },
                    "required": ["parties", "topic"],
                },
            },
            "full_mom_markdown": {
                "type": "string",
                "description": (
                    "Complete Minutes of Meeting as well-formatted markdown. "
                    "Must include: Attendees, Key Decisions, Commitments table, "
                    "Open Questions, Next Steps. Readable standalone."
                ),
            },
            "notes": {
                "type": ["string", "null"],
                "description": "Any issues: ambiguities, missing info, low confidence areas.",
            },
        },
        "required": [
            "date",
            "attendees",
            "decisions",
            "commitments",
            "open_questions",
            "disagreements",
            "full_mom_markdown",
        ],
    },
}


# ─────────────────────────────────────────────────────────────
# ScribeAgent
# ─────────────────────────────────────────────────────────────

class ScribeAgent:
    """Extract structured meeting intelligence from transcripts using Opus 4.7.

    Scribe reads meeting transcripts and produces structured MeetingRecords
    with decisions, commitments, open questions, and disagreements. It also
    generates a human-readable MoM markdown for the project binder.

    Args:
        memory: The ProjectMemory instance to write meetings and commitments into.
        api_key: Anthropic API key. If None, reads from ANTHROPIC_API_KEY env var.
    """

    def __init__(
        self,
        memory: ProjectMemory,
        api_key: str | None = None,
    ) -> None:
        self.memory = memory
        resolved_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not resolved_key:
            raise ValueError(
                "ANTHROPIC_API_KEY not provided and not set in environment. "
                "Pass api_key= or set the ANTHROPIC_API_KEY env var."
            )
        self.client = anthropic.Anthropic(api_key=resolved_key)
        self.system_prompt = self._load_system_prompt()
        # Accumulated token usage across all API calls in a single run().
        # Read by the Orchestrator after run() to emit real budget data via SSE.
        self.total_tokens_used: int = 0

    @staticmethod
    def _load_system_prompt() -> str:
        """Load the Scribe system prompt from /prompts/scribe.md.

        The prompt lives in a separate file so it's human-readable and
        reviewable outside of code. See CLAUDE.md § Rule 3.
        """
        prompt_path = Path(__file__).resolve().parent.parent.parent / "prompts" / "scribe.md"
        if not prompt_path.exists():
            raise FileNotFoundError(
                f"Scribe system prompt not found at {prompt_path}. "
                f"Expected a file at /prompts/scribe.md relative to the repo root."
            )
        return prompt_path.read_text(encoding="utf-8")

    def run(
        self,
        project_id: str,
        transcript: str,
        source_file_path: str | None = None,
    ) -> MeetingRecord:
        """Process a meeting transcript and persist results to project memory.

        Makes a single Opus 4.7 call with the full transcript in context.
        The transcript is text-only, so no vision is needed. Uses tool-forced
        output for reliable structured extraction.

        Args:
            project_id: The project slug in ProjectMemory.
            transcript: Full text of the meeting transcript.
            source_file_path: Optional path to the original transcript file.

        Returns:
            MeetingRecord with all extracted data. Also persists the meeting
            and commitments to ProjectMemory.

        Raises:
            ValueError: if transcript is empty.
            anthropic.APIError: on Anthropic API failures.
        """
        if not transcript.strip():
            raise ValueError("Transcript is empty. Provide the meeting text.")

        # Read the project's logframe so Scribe can map commitments to indicators
        logframe_text = self._read_logframe(project_id)

        logger.info(
            "Scribe processing transcript: %d chars, project=%s",
            len(transcript),
            project_id,
        )

        # Reset token counter for this run invocation
        self.total_tokens_used = 0

        # Opus 4.7 call with tool-forced structured output
        # NOTE: thinking + forced tool_choice is not allowed by the API
        # (same constraint as Scout, see sessions/003-scout.md).
        # We prioritize forced tool use for reliable structured output.
        response = self.client.messages.create(
            model=MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=self.system_prompt,
            tools=[RECORD_MEETING_TOOL],
            tool_choice={"type": "tool", "name": "record_meeting"},
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"## Project Logframe\n\n{logframe_text}\n\n---\n\n"
                        f"## Meeting Transcript\n\n{transcript}\n\n---\n\n"
                        "Extract all decisions, commitments, open questions, and "
                        "disagreements from this meeting transcript. Produce a "
                        "complete Minutes of Meeting."
                    ),
                }
            ],
        )

        # Track real token usage from response.usage for budget countdown UI
        self.total_tokens_used += response.usage.input_tokens + response.usage.output_tokens

        # Parse the tool use response into a MeetingRecord
        meeting_record = self._parse_tool_response(response)

        # Persist to ProjectMemory
        self._persist_to_memory(project_id, meeting_record, source_file_path)

        logger.info(
            "Scribe finished: %d decisions, %d commitments, %d open questions",
            len(meeting_record.decisions),
            len(meeting_record.commitments),
            len(meeting_record.open_questions),
        )

        return meeting_record

    def _read_logframe(self, project_id: str) -> str:
        """Read the project logframe text, returning empty string if not found.

        Args:
            project_id: The project slug.

        Returns:
            Logframe markdown text, or a placeholder message.
        """
        project_dir = self.memory._project_dir(project_id)
        logframe_path = project_dir / "logframe.md"

        if not logframe_path.exists():
            return "(No logframe loaded for this project.)"

        logframe_text = logframe_path.read_text(encoding="utf-8")
        # Strip YAML frontmatter if present
        if logframe_text.startswith("---\n"):
            parts = logframe_text.split("---\n", maxsplit=2)
            if len(parts) >= 3:
                logframe_text = parts[2].strip()

        return logframe_text

    @staticmethod
    def _parse_tool_response(response: anthropic.types.Message) -> MeetingRecord:
        """Extract MeetingRecord from the Opus 4.7 tool use response.

        Args:
            response: The API response with a record_meeting tool use block.

        Returns:
            Parsed MeetingRecord.

        Raises:
            ValueError: if the response doesn't contain the expected tool use.
        """
        for block in response.content:
            if block.type == "tool_use" and block.name == "record_meeting":
                tool_input = block.input
                if not isinstance(tool_input, dict):
                    raise ValueError(
                        f"record_meeting tool input is not a dict: {type(tool_input)}"
                    )

                # Parse commitments into ExtractedCommitment objects
                raw_commitments = tool_input.get("commitments", [])
                commitments = [
                    ExtractedCommitment(**c) for c in raw_commitments
                ]

                # Parse disagreements into Disagreement objects
                raw_disagreements = tool_input.get("disagreements", [])
                disagreements = [
                    Disagreement(**d) for d in raw_disagreements
                ]

                return MeetingRecord(
                    date=tool_input.get("date", "unknown"),
                    location=tool_input.get("location"),
                    attendees=tool_input.get("attendees", []),
                    decisions=tool_input.get("decisions", []),
                    commitments=commitments,
                    open_questions=tool_input.get("open_questions", []),
                    disagreements=disagreements,
                    full_mom_markdown=tool_input.get("full_mom_markdown", ""),
                    notes=tool_input.get("notes"),
                )

        content_types = [block.type for block in response.content]
        raise ValueError(
            f"Expected record_meeting tool use in response, "
            f"but got content types: {content_types}. "
            f"This should not happen with tool_choice forced."
        )

    def _persist_to_memory(
        self,
        project_id: str,
        record: MeetingRecord,
        source_file_path: str | None,
    ) -> None:
        """Write meeting and commitments to ProjectMemory.

        Args:
            project_id: The project slug.
            record: The parsed MeetingRecord.
            source_file_path: Path to the original transcript file.
        """
        # Generate a meeting ID
        short_id = uuid.uuid4().hex[:8]
        meeting_id = f"mtg-{short_id}"

        # Build the Meeting model for ProjectMemory
        meeting = Meeting(
            meeting_id=meeting_id,
            date=record.date,
            location=record.location,
            attendees=record.attendees,
            agenda=None,
            decisions=record.decisions,
            open_questions=record.open_questions,
            source_file=source_file_path,
        )

        # Write meeting with the full MoM as the markdown body
        self.memory.add_meeting(project_id, meeting, body=record.full_mom_markdown)

        # Write each commitment
        for idx, commitment in enumerate(record.commitments):
            commitment_short_id = uuid.uuid4().hex[:8]
            commitment_id = f"cmt-{commitment_short_id}"

            memory_commitment = Commitment(
                commitment_id=commitment_id,
                made_in_meeting=meeting_id,
                owner=commitment.owner,
                description=commitment.description,
                due_date=commitment.due_date,
                status=CommitmentStatus.OPEN,
            )

            self.memory.add_commitment(project_id, memory_commitment)

        logger.info(
            "Scribe persisted meeting %s with %d commitments to project %s",
            meeting_id,
            len(record.commitments),
            project_id,
        )
