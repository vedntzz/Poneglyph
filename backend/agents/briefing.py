"""Briefing agent — pre-meeting preparation with grounded recommendations.

Produces a structured briefing for a PM about to face a stakeholder.
Each recommendation cites specific files from the project binder —
evidence IDs, meeting IDs, commitment IDs. No generic advice.

Combines two patterns from existing agents:
- Archivist's agentic tool-use loop for on-demand memory reading
- Drafter's forced tool_choice for structured output

The briefing is action-shaped, not status-shaped. It tells the PM what
to push for, what will be pushed back on, and what to avoid raising.

See prompts/briefing.md, CAPABILITIES.md#file-memory,
CAPABILITIES.md#adaptive-thinking.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import anthropic
from pydantic import BaseModel, Field

from memory.project_memory import ProjectMemory

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MODEL = "claude-opus-4-7"

MAX_OUTPUT_TOKENS = 16_000

# Briefing reads memory then produces output — fewer rounds needed
# than Archivist queries since we always read everything.
MAX_TOOL_ROUNDS = 8


# ─────────────────────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────────────────────

class BriefingItem(BaseModel):
    """A single recommendation in the briefing, grounded in project data."""

    text: str = Field(description="The recommendation — specific, actionable.")
    citations: list[str] = Field(
        description="IDs from the project binder (ev-*, mtg-*, cmt-*).",
    )
    rationale: str = Field(
        description="Why this matters — distinguishes facts from inferences.",
    )


class Briefing(BaseModel):
    """Structured pre-meeting briefing for a stakeholder interaction."""

    stakeholder: str = Field(description="Who the meeting is with.")
    meeting_context: str | None = Field(
        default=None,
        description="Optional context about the meeting topic.",
    )
    project_summary: str = Field(
        description="2-3 sentences framing the overall project status.",
    )
    push_for: list[BriefingItem] = Field(
        description="Exactly 3 items to push for, ranked by importance.",
    )
    push_back_on_us: list[BriefingItem] = Field(
        description="Exactly 3 items they will push back on, ranked by likelihood.",
    )
    do_not_bring_up: list[BriefingItem] = Field(
        description="Exactly 2 sensitive items to avoid raising proactively.",
    )
    closing_note: str = Field(
        description="1-2 sentences naming the biggest risk.",
    )


# ─────────────────────────────────────────────────────────────
# Memory-reading tools — same set as Archivist and Drafter
# ─────────────────────────────────────────────────────────────

# These tools let the Briefing agent read the project binder on demand.
# Same pattern as Archivist: model decides what's relevant and reads it.
# See CAPABILITIES.md#file-memory.

MEMORY_TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_evidence",
        "description": "List all evidence items in the project binder with summaries.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "list_meetings",
        "description": "List all meeting records in the project binder with summaries.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "list_commitments",
        "description": "List all tracked commitments in the project binder.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "read_evidence_file",
        "description": "Read a specific evidence file from the project binder.",
        "input_schema": {
            "type": "object",
            "properties": {"evidence_id": {"type": "string"}},
            "required": ["evidence_id"],
        },
    },
    {
        "name": "read_meeting_file",
        "description": "Read a specific meeting record from the project binder.",
        "input_schema": {
            "type": "object",
            "properties": {"meeting_id": {"type": "string"}},
            "required": ["meeting_id"],
        },
    },
    {
        "name": "read_commitment_file",
        "description": "Read a specific commitment file from the project binder.",
        "input_schema": {
            "type": "object",
            "properties": {"commitment_id": {"type": "string"}},
            "required": ["commitment_id"],
        },
    },
    {
        "name": "read_logframe",
        "description": "Read the project logframe (targets and indicators).",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "read_timeline",
        "description": (
            "Read the project timeline — a chronological log of all events."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
]

# Tool for structured briefing output — forced via tool_choice
GENERATE_BRIEFING_TOOL: dict[str, Any] = {
    "name": "generate_briefing",
    "description": (
        "Submit the complete pre-meeting briefing. Call this ONLY after "
        "reading all relevant files from the project binder."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "project_summary": {
                "type": "string",
                "description": "2-3 sentences framing overall project status.",
            },
            "push_for": {
                "type": "array",
                "description": "Exactly 3 items to push for, ranked by importance.",
                "minItems": 3,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "The specific recommendation.",
                        },
                        "citations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "IDs from the binder (ev-*, mtg-*, cmt-*).",
                        },
                        "rationale": {
                            "type": "string",
                            "description": "Why this matters.",
                        },
                    },
                    "required": ["text", "citations", "rationale"],
                },
            },
            "push_back_on_us": {
                "type": "array",
                "description": "Exactly 3 items they will push back on, ranked by likelihood.",
                "minItems": 3,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "What the stakeholder will raise.",
                        },
                        "citations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "IDs from the binder (ev-*, mtg-*, cmt-*).",
                        },
                        "rationale": {
                            "type": "string",
                            "description": "Why they'll raise it and how to respond.",
                        },
                    },
                    "required": ["text", "citations", "rationale"],
                },
            },
            "do_not_bring_up": {
                "type": "array",
                "description": "Exactly 2 sensitive items to avoid raising.",
                "minItems": 2,
                "maxItems": 2,
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "The topic to avoid.",
                        },
                        "citations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "IDs from the binder.",
                        },
                        "rationale": {
                            "type": "string",
                            "description": "Why it's sensitive.",
                        },
                    },
                    "required": ["text", "citations", "rationale"],
                },
            },
            "closing_note": {
                "type": "string",
                "description": "1-2 sentences naming the single biggest risk.",
            },
        },
        "required": [
            "project_summary",
            "push_for",
            "push_back_on_us",
            "do_not_bring_up",
            "closing_note",
        ],
    },
}


# ─────────────────────────────────────────────────────────────
# BriefingAgent
# ─────────────────────────────────────────────────────────────

class BriefingAgent:
    """Generate pre-meeting briefings grounded in the project binder.

    Reads evidence, meetings, commitments, and contradictions on demand
    using tool use, then produces a structured briefing with specific
    citations. Combines Archivist's memory-reading pattern with Drafter's
    forced structured output.

    Args:
        memory: The ProjectMemory instance to read from.
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
        # Read by the Orchestrator / endpoint to report cost.
        self.total_tokens_used: int = 0

    @staticmethod
    def _load_system_prompt() -> str:
        """Load the Briefing system prompt from /prompts/briefing.md."""
        prompt_path = (
            Path(__file__).resolve().parent.parent.parent
            / "prompts"
            / "briefing.md"
        )
        if not prompt_path.exists():
            raise FileNotFoundError(
                f"Briefing system prompt not found at {prompt_path}. "
                f"Expected a file at /prompts/briefing.md relative to the repo root."
            )
        return prompt_path.read_text(encoding="utf-8")

    # ─── Main entry point ──────────────────────────────────────

    def generate(
        self,
        project_id: str,
        stakeholder: str,
        meeting_context: str | None = None,
    ) -> Briefing:
        """Generate a pre-meeting briefing for a stakeholder interaction.

        Phase 1 (agentic loop): reads relevant files from the project binder
        using tool use — model decides what to read.

        Phase 2 (forced output): once the model has read enough, it calls
        generate_briefing with the complete structured output.

        Args:
            project_id: The project slug.
            stakeholder: Who the meeting is with (e.g., "World Bank").
            meeting_context: Optional free-text about the meeting topic.

        Returns:
            Briefing with grounded recommendations and citations.

        Raises:
            ValueError: if stakeholder is empty.
            anthropic.APIError: on API failures.
        """
        if not stakeholder.strip():
            raise ValueError("Stakeholder is empty. Who is the meeting with?")

        logger.info(
            "Briefing agent preparing for %s meeting, project=%s",
            stakeholder,
            project_id,
        )

        # Reset token counter for this invocation
        self.total_tokens_used = 0

        # Phase 1: agentic loop with memory tools + output tool available
        # The model reads the binder, then when ready calls generate_briefing.
        # Adaptive thinking is enabled for cross-document reasoning.
        all_tools = MEMORY_TOOLS + [GENERATE_BRIEFING_TOOL]

        context_section = ""
        if meeting_context:
            context_section = f"\n\n**Meeting context:** {meeting_context}"

        messages: list[dict[str, Any]] = [
            {
                "role": "user",
                "content": (
                    f"## Pre-Meeting Briefing Request\n\n"
                    f"**Project:** {project_id}\n"
                    f"**Stakeholder:** {stakeholder}"
                    f"{context_section}\n\n"
                    f"## Instructions\n\n"
                    f"Prepare a tactical briefing for a PM about to meet "
                    f"with {stakeholder}. Follow these steps:\n\n"
                    f"1. List all evidence, meetings, and commitments\n"
                    f"2. Read the logframe to understand targets\n"
                    f"3. Read the specific meetings and commitments in detail\n"
                    f"4. Read key evidence files to understand what's been verified\n"
                    f"5. Pay special attention to contradictions — any case where "
                    f"later meetings silently changed numbers or deadlines from "
                    f"earlier commitments. These are critical for push_back items.\n"
                    f"6. When you have enough context, call generate_briefing\n\n"
                    f"Remember: every recommendation must cite specific IDs. "
                    f"Think like the stakeholder when writing push_back items. "
                    f"Be action-shaped, not status-shaped."
                ),
            }
        ]

        for round_num in range(MAX_TOOL_ROUNDS):
            # Opus 4.7 adaptive thinking for cross-document reasoning
            # See CAPABILITIES.md#adaptive-thinking
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=MAX_OUTPUT_TOKENS,
                system=self.system_prompt,
                tools=all_tools,
                thinking={"type": "adaptive"},
                messages=messages,
            )

            # Track real token usage from response.usage
            self.total_tokens_used += (
                response.usage.input_tokens + response.usage.output_tokens
            )

            # Check if the model produced the final briefing
            briefing = self._check_for_briefing(response, stakeholder, meeting_context)
            if briefing is not None:
                logger.info(
                    "Briefing completed in %d rounds (%d tokens)",
                    round_num + 1,
                    self.total_tokens_used,
                )
                return briefing

            # Process memory-reading tool calls
            tool_results = self._process_tool_calls(response, project_id)

            if not tool_results:
                # Model didn't call any tools and didn't produce a briefing
                logger.warning(
                    "Briefing agent produced no tool calls and no output, forcing stop"
                )
                return Briefing(
                    stakeholder=stakeholder,
                    meeting_context=meeting_context,
                    project_summary="Unable to generate briefing — project binder may be empty.",
                    push_for=[],
                    push_back_on_us=[],
                    do_not_bring_up=[],
                    closing_note="No data available for briefing preparation.",
                )

            # Build conversation for next round — preserve thinking blocks
            assistant_content: list[dict[str, Any]] = []
            for block in response.content:
                if block.type == "thinking":
                    assistant_content.append({
                        "type": "thinking",
                        "thinking": block.thinking,
                        "signature": block.signature,
                    })
                elif block.type == "text":
                    assistant_content.append({"type": "text", "text": block.text})
                elif block.type == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })

            messages.append({"role": "assistant", "content": assistant_content})
            messages.append({"role": "user", "content": tool_results})

        # Exhausted rounds without producing a briefing
        logger.warning(
            "Briefing agent hit max rounds (%d) without completing",
            MAX_TOOL_ROUNDS,
        )
        return Briefing(
            stakeholder=stakeholder,
            meeting_context=meeting_context,
            project_summary="Briefing incomplete — exceeded maximum tool-use rounds.",
            push_for=[],
            push_back_on_us=[],
            do_not_bring_up=[],
            closing_note="Could not complete briefing within allowed rounds.",
        )

    # ─── Response parsing ──────────────────────────────────────

    def _check_for_briefing(
        self,
        response: anthropic.types.Message,
        stakeholder: str,
        meeting_context: str | None,
    ) -> Briefing | None:
        """Check if the response contains a generate_briefing tool call.

        Returns:
            Briefing if found, None otherwise.
        """
        for block in response.content:
            if block.type == "tool_use" and block.name == "generate_briefing":
                tool_input = block.input
                if not isinstance(tool_input, dict):
                    continue

                return Briefing(
                    stakeholder=stakeholder,
                    meeting_context=meeting_context,
                    project_summary=tool_input.get("project_summary", ""),
                    push_for=[
                        BriefingItem(**item)
                        for item in tool_input.get("push_for", [])
                    ],
                    push_back_on_us=[
                        BriefingItem(**item)
                        for item in tool_input.get("push_back_on_us", [])
                    ],
                    do_not_bring_up=[
                        BriefingItem(**item)
                        for item in tool_input.get("do_not_bring_up", [])
                    ],
                    closing_note=tool_input.get("closing_note", ""),
                )
        return None

    # ─── Tool execution ────────────────────────────────────────

    def _process_tool_calls(
        self,
        response: anthropic.types.Message,
        project_id: str,
    ) -> list[dict[str, Any]]:
        """Execute memory-reading tool calls and return results."""
        results: list[dict[str, Any]] = []

        for block in response.content:
            if block.type != "tool_use":
                continue
            # Skip the output tool — handled separately
            if block.name == "generate_briefing":
                continue

            tool_output = self._execute_memory_tool(
                block.name, block.input or {}, project_id
            )
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": tool_output,
            })

        return results

    def _execute_memory_tool(
        self,
        tool_name: str,
        tool_input: dict[str, Any],
        project_id: str,
    ) -> str:
        """Execute a single memory-reading tool and return text result.

        Same memory access as Archivist and Drafter — reads from ProjectMemory.
        """
        if tool_name == "list_evidence":
            return self._list_evidence(project_id)
        elif tool_name == "list_meetings":
            return self._list_meetings(project_id)
        elif tool_name == "list_commitments":
            return self._list_commitments(project_id)
        elif tool_name == "read_evidence_file":
            return self._read_file(
                project_id, "evidence", tool_input.get("evidence_id", "")
            )
        elif tool_name == "read_meeting_file":
            return self._read_file(
                project_id, "meetings", tool_input.get("meeting_id", "")
            )
        elif tool_name == "read_commitment_file":
            return self._read_file(
                project_id, "commitments", tool_input.get("commitment_id", "")
            )
        elif tool_name == "read_logframe":
            return self._read_logframe(project_id)
        elif tool_name == "read_timeline":
            return self._read_timeline(project_id)
        else:
            return f"Unknown tool: {tool_name}"

    # ─── Memory access helpers ─────────────────────────────────

    def _list_evidence(self, project_id: str) -> str:
        """List all evidence items with summaries."""
        evidence_list = self.memory.read_all_evidence(project_id)
        if not evidence_list:
            return "No evidence files found in the project binder."

        lines = [f"Found {len(evidence_list)} evidence items:\n"]
        for ev in evidence_list:
            indicator = ev.logframe_indicator or "unmapped"
            confidence = ev.confidence.value if ev.confidence else "unknown"
            lines.append(
                f"- {ev.evidence_id} | {ev.source.value} | {ev.date_collected} | "
                f"indicator: {indicator} | confidence: {confidence} | "
                f"{ev.summary[:120]}"
            )
        return "\n".join(lines)

    def _list_meetings(self, project_id: str) -> str:
        """List all meetings with summaries."""
        meetings = self.memory.read_all_meetings(project_id)
        if not meetings:
            return "No meeting records found in the project binder."

        lines = [f"Found {len(meetings)} meeting records:\n"]
        for mtg in meetings:
            lines.append(
                f"- {mtg.meeting_id} | {mtg.date} | {len(mtg.attendees)} attendees | "
                f"{len(mtg.decisions)} decisions | {mtg.location or 'no location'}"
            )
        return "\n".join(lines)

    def _list_commitments(self, project_id: str) -> str:
        """List all commitments with summaries."""
        commitments = self.memory.read_all_commitments(project_id)
        if not commitments:
            return "No commitments found in the project binder."

        lines = [f"Found {len(commitments)} commitments:\n"]
        for cmt in commitments:
            due = cmt.due_date or "no deadline"
            status = cmt.status.value if hasattr(cmt.status, "value") else str(cmt.status)
            lines.append(
                f"- {cmt.commitment_id} | owner: {cmt.owner} | due: {due} | "
                f"status: {status} | {cmt.description[:120]}"
            )
        return "\n".join(lines)

    def _read_file(self, project_id: str, subdir: str, file_id: str) -> str:
        """Read a specific file from a project binder subdirectory."""
        file_path = (
            self.memory._project_dir(project_id) / subdir / f"{file_id}.md"
        )
        if not file_path.exists():
            return f"File not found: {subdir}/{file_id}.md"
        return file_path.read_text(encoding="utf-8")

    def _read_logframe(self, project_id: str) -> str:
        """Read the project logframe."""
        logframe_path = self.memory._project_dir(project_id) / "logframe.md"
        if not logframe_path.exists():
            return "No logframe found for this project."
        return logframe_path.read_text(encoding="utf-8")

    def _read_timeline(self, project_id: str) -> str:
        """Read the project timeline."""
        timeline_path = self.memory._project_dir(project_id) / "timeline.md"
        if not timeline_path.exists():
            return "No timeline found for this project."
        return timeline_path.read_text(encoding="utf-8")
