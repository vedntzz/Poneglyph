"""Archivist agent — project memory custodian with on-demand file reading.

The Archivist owns the project binder. It answers queries by reading specific
memory files using tool use, and detects contradictions across meetings by
reasoning over commitments and their evolution.

This is the showcase for Opus 4.7's file-system-based persistent memory:
instead of loading all project data into context, the Archivist reads its
own notes from disk on demand — like a consultant re-opening a project binder.
See CAPABILITIES.md#file-memory, ARCHITECTURE.md#archivist-design.

Key design decisions:
- Tool-use-driven memory access: we define tools (list_evidence, read_meeting_file,
  etc.) that the model calls to read specific files. The model decides what to read.
- Two modes: answer_query (agentic loop with tool use) and detect_contradictions
  (single deep-reasoning call with xhigh effort).
- Agentic loop for queries: the model may need multiple rounds of file reads
  to assemble a complete answer. We run a tool-use loop until the model
  produces a final answer.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import anthropic
from pydantic import BaseModel, Field

from memory.models import (
    Commitment,
    CommitmentStatus,
    Evidence,
    Meeting,
)
from memory.project_memory import ProjectMemory, _read_markdown

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MODEL = "claude-opus-4-7"

MAX_OUTPUT_TOKENS = 16_000

# Maximum tool-use rounds before we force a final answer.
# Lowered from 10 → 6: agents typically converge in 2-3 rounds,
# and the tail rounds add latency without improving quality.
MAX_TOOL_ROUNDS = 6


# ─────────────────────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────────────────────

class Citation(BaseModel):
    """A reference to a specific file in the project binder."""

    file_path: str = Field(description="Path within the project binder, e.g. 'evidence/ev-001.md'.")
    excerpt: str = Field(description="Relevant excerpt or summary from the cited file.")


class AnswerWithCitations(BaseModel):
    """Archivist's response to a project query."""

    answer: str = Field(description="The answer, grounded in project memory.")
    citations: list[Citation] = Field(description="Files cited in the answer.")
    gaps: list[str] = Field(
        default_factory=list,
        description="Information gaps — what's missing from the project binder.",
    )


class Contradiction(BaseModel):
    """A detected contradiction between project records."""

    description: str = Field(description="What the contradiction is.")
    earlier_source: str = Field(description="File path of the earlier claim.")
    later_source: str = Field(description="File path of the later claim.")
    earlier_claim: str = Field(description="What was originally stated.")
    later_claim: str = Field(description="What was later stated that contradicts it.")
    severity: str = Field(description="'high', 'medium', or 'low' impact on the project.")


# ─────────────────────────────────────────────────────────────
# Memory-reading tools — the Archivist's binder interface
# ─────────────────────────────────────────────────────────────

# These tools let Opus 4.7 read project memory files on demand.
# The model decides which files are relevant and reads them selectively.
# This is the "consultant opens their binder" behavior.
# See CAPABILITIES.md#file-memory.

MEMORY_TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_evidence",
        "description": (
            "List all evidence files in the project binder. Returns a summary "
            "of each evidence item (ID, source type, date, indicator, summary) "
            "so you can decide which ones to read in full."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "list_meetings",
        "description": (
            "List all meeting records in the project binder. Returns a summary "
            "of each meeting (ID, date, attendees, decisions count) so you can "
            "decide which ones to read in full."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "list_commitments",
        "description": (
            "List all tracked commitments in the project binder. Returns each "
            "commitment's ID, owner, description, due date, and status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "read_evidence_file",
        "description": "Read a specific evidence file from the project binder.",
        "input_schema": {
            "type": "object",
            "properties": {
                "evidence_id": {
                    "type": "string",
                    "description": "Evidence ID, e.g. 'ev-001'.",
                },
            },
            "required": ["evidence_id"],
        },
    },
    {
        "name": "read_meeting_file",
        "description": "Read a specific meeting record from the project binder.",
        "input_schema": {
            "type": "object",
            "properties": {
                "meeting_id": {
                    "type": "string",
                    "description": "Meeting ID, e.g. 'mtg-001'.",
                },
            },
            "required": ["meeting_id"],
        },
    },
    {
        "name": "read_commitment_file",
        "description": "Read a specific commitment file from the project binder.",
        "input_schema": {
            "type": "object",
            "properties": {
                "commitment_id": {
                    "type": "string",
                    "description": "Commitment ID, e.g. 'cmt-001'.",
                },
            },
            "required": ["commitment_id"],
        },
    },
    {
        "name": "read_timeline",
        "description": (
            "Read the project timeline — a chronological log of all events "
            "(evidence added, meetings logged, commitments made, etc.)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]

# Tool for structured answer output
ANSWER_QUERY_TOOL: dict[str, Any] = {
    "name": "answer_query",
    "description": (
        "Submit your final answer to the user's query with citations. "
        "Call this ONLY after you have read all relevant files."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "answer": {
                "type": "string",
                "description": "Your answer, grounded in the files you read.",
            },
            "citations": {
                "type": "array",
                "description": "Files you cited in your answer.",
                "items": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Path within the binder, e.g. 'evidence/ev-001.md'.",
                        },
                        "excerpt": {
                            "type": "string",
                            "description": "Key excerpt from the file.",
                        },
                    },
                    "required": ["file_path", "excerpt"],
                },
            },
            "gaps": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Information gaps — what's missing from the binder.",
            },
        },
        "required": ["answer", "citations"],
    },
}

# Tool for structured contradiction output
REPORT_CONTRADICTIONS_TOOL: dict[str, Any] = {
    "name": "report_contradictions",
    "description": (
        "Report all contradictions found across the project's commitments "
        "and meeting records. Call this after analyzing all relevant files."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "contradictions": {
                "type": "array",
                "description": "List of detected contradictions.",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {
                            "type": "string",
                            "description": "What the contradiction is.",
                        },
                        "earlier_source": {
                            "type": "string",
                            "description": "File path of the earlier claim.",
                        },
                        "later_source": {
                            "type": "string",
                            "description": "File path of the later claim.",
                        },
                        "earlier_claim": {
                            "type": "string",
                            "description": "What was originally stated.",
                        },
                        "later_claim": {
                            "type": "string",
                            "description": "What was later stated.",
                        },
                        "severity": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                            "description": "Impact severity.",
                        },
                    },
                    "required": [
                        "description",
                        "earlier_source",
                        "later_source",
                        "earlier_claim",
                        "later_claim",
                        "severity",
                    ],
                },
            },
        },
        "required": ["contradictions"],
    },
}


# ─────────────────────────────────────────────────────────────
# ArchivistAgent
# ─────────────────────────────────────────────────────────────

class ArchivistAgent:
    """Project memory custodian — answers queries and detects contradictions.

    The Archivist reads project memory files on demand using tool use,
    reasons across evidence and meetings, and returns grounded answers
    with precise citations. This showcases Opus 4.7's file-system-based
    persistent memory. See CAPABILITIES.md#file-memory.

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
        # Accumulated token usage across all API calls in a single method invocation.
        # Read by the Orchestrator after answer_query() / detect_contradictions()
        # to emit real budget data via SSE.
        self.total_tokens_used: int = 0

    @staticmethod
    def _load_system_prompt() -> str:
        """Load the Archivist system prompt from /prompts/archivist.md."""
        prompt_path = Path(__file__).resolve().parent.parent.parent / "prompts" / "archivist.md"
        if not prompt_path.exists():
            raise FileNotFoundError(
                f"Archivist system prompt not found at {prompt_path}. "
                f"Expected a file at /prompts/archivist.md relative to the repo root."
            )
        return prompt_path.read_text(encoding="utf-8")

    # ─── Query answering (agentic tool-use loop) ────────────

    def answer_query(
        self,
        project_id: str,
        query: str,
    ) -> AnswerWithCitations:
        """Answer a question about the project by reading memory files on demand.

        Runs an agentic loop: Opus 4.7 decides which memory files to read,
        reads them via tool calls, then produces a final answer with citations.
        This is the "consultant opens their binder" behavior.

        Args:
            project_id: The project slug.
            query: The user's question about the project.

        Returns:
            AnswerWithCitations with the grounded answer, file citations,
            and identified information gaps.

        Raises:
            ValueError: if query is empty.
            anthropic.APIError: on API failures.
        """
        if not query.strip():
            raise ValueError("Query is empty. Ask a question about the project.")

        logger.info("Archivist answering query for project=%s: %s", project_id, query[:80])

        # Reset token counter for this invocation
        self.total_tokens_used = 0

        # All tools: memory-reading tools + the final answer tool
        all_tools = MEMORY_TOOLS + [ANSWER_QUERY_TOOL]

        # Opus 4.7 agentic loop: tool use for reading, then final answer
        # We use adaptive thinking here because the model needs to reason
        # across multiple files. See CAPABILITIES.md#adaptive-thinking.
        messages: list[dict[str, Any]] = [
            {
                "role": "user",
                "content": (
                    f"Project ID: {project_id}\n\n"
                    f"Question: {query}\n\n"
                    "Read the relevant files from the project binder to answer "
                    "this question. Start by listing what's available, then read "
                    "the specific files you need. When you have enough information, "
                    "call answer_query with your grounded response."
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
            self.total_tokens_used += response.usage.input_tokens + response.usage.output_tokens

            # Check if the model produced a final answer
            final_answer = self._check_for_answer(response)
            if final_answer is not None:
                logger.info(
                    "Archivist answered in %d rounds with %d citations",
                    round_num + 1,
                    len(final_answer.citations),
                )
                return final_answer

            # Process tool calls and build tool results
            tool_results = self._process_tool_calls(response, project_id)

            if not tool_results:
                # Model didn't call any tools and didn't answer — force stop
                logger.warning("Archivist produced no tool calls and no answer, forcing stop")
                return AnswerWithCitations(
                    answer="I was unable to find relevant information in the project binder.",
                    citations=[],
                    gaps=["No files read — the project binder may be empty."],
                )

            # Build the assistant message content (include all blocks)
            assistant_content: list[dict[str, Any]] = []
            for block in response.content:
                if block.type == "thinking":
                    assistant_content.append({
                        "type": "thinking",
                        "thinking": block.thinking,
                        "signature": block.signature,
                    })
                elif block.type == "text":
                    assistant_content.append({
                        "type": "text",
                        "text": block.text,
                    })
                elif block.type == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })

            # Add assistant response and tool results to conversation
            messages.append({"role": "assistant", "content": assistant_content})
            messages.append({"role": "user", "content": tool_results})

        # Exhausted rounds without a final answer
        logger.warning("Archivist hit max rounds (%d) without final answer", MAX_TOOL_ROUNDS)
        return AnswerWithCitations(
            answer="I read several files but could not formulate a complete answer within the allowed rounds.",
            citations=[],
            gaps=["Query may be too broad — try asking about a specific indicator or time period."],
        )

    def _check_for_answer(
        self,
        response: anthropic.types.Message,
    ) -> AnswerWithCitations | None:
        """Check if the response contains a final answer_query tool call.

        Returns:
            AnswerWithCitations if found, None otherwise.
        """
        for block in response.content:
            if block.type == "tool_use" and block.name == "answer_query":
                tool_input = block.input
                if not isinstance(tool_input, dict):
                    continue

                citations = [
                    Citation(**c) for c in tool_input.get("citations", [])
                ]
                return AnswerWithCitations(
                    answer=tool_input.get("answer", ""),
                    citations=citations,
                    gaps=tool_input.get("gaps", []),
                )
        return None

    def _process_tool_calls(
        self,
        response: anthropic.types.Message,
        project_id: str,
    ) -> list[dict[str, Any]]:
        """Execute memory-reading tool calls and return results.

        Args:
            response: The API response containing tool_use blocks.
            project_id: The project slug for memory lookups.

        Returns:
            List of tool_result content blocks for the next message.
        """
        results: list[dict[str, Any]] = []

        for block in response.content:
            if block.type != "tool_use":
                continue

            # Skip the answer tool — handled separately
            if block.name == "answer_query":
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
        """Execute a single memory-reading tool and return the result as text.

        Args:
            tool_name: Name of the tool to execute.
            tool_input: Tool input parameters.
            project_id: The project slug.

        Returns:
            Text result of the tool execution.
        """
        if tool_name == "list_evidence":
            return self._list_evidence(project_id)
        elif tool_name == "list_meetings":
            return self._list_meetings(project_id)
        elif tool_name == "list_commitments":
            return self._list_commitments(project_id)
        elif tool_name == "read_evidence_file":
            return self._read_evidence_file(project_id, tool_input.get("evidence_id", ""))
        elif tool_name == "read_meeting_file":
            return self._read_meeting_file(project_id, tool_input.get("meeting_id", ""))
        elif tool_name == "read_commitment_file":
            return self._read_commitment_file(project_id, tool_input.get("commitment_id", ""))
        elif tool_name == "read_timeline":
            return self._read_timeline(project_id)
        else:
            return f"Unknown tool: {tool_name}"

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
                f"{ev.summary[:100]}"
            )
        return "\n".join(lines)

    def _list_meetings(self, project_id: str) -> str:
        """List all meetings with summaries."""
        meetings = self.memory.read_all_meetings(project_id)
        if not meetings:
            return "No meeting records found in the project binder."

        lines = [f"Found {len(meetings)} meeting records:\n"]
        for mtg in meetings:
            attendee_count = len(mtg.attendees)
            decision_count = len(mtg.decisions)
            lines.append(
                f"- {mtg.meeting_id} | {mtg.date} | {attendee_count} attendees | "
                f"{decision_count} decisions | {mtg.location or 'no location'}"
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
            status = cmt.status.value if isinstance(cmt.status, CommitmentStatus) else cmt.status
            lines.append(
                f"- {cmt.commitment_id} | owner: {cmt.owner} | due: {due} | "
                f"status: {status} | {cmt.description[:100]}"
            )
        return "\n".join(lines)

    def _read_evidence_file(self, project_id: str, evidence_id: str) -> str:
        """Read a specific evidence file's full contents."""
        file_path = self.memory._project_dir(project_id) / "evidence" / f"{evidence_id}.md"
        if not file_path.exists():
            return f"Evidence file not found: {evidence_id}"
        return file_path.read_text(encoding="utf-8")

    def _read_meeting_file(self, project_id: str, meeting_id: str) -> str:
        """Read a specific meeting file's full contents."""
        file_path = self.memory._project_dir(project_id) / "meetings" / f"{meeting_id}.md"
        if not file_path.exists():
            return f"Meeting file not found: {meeting_id}"
        return file_path.read_text(encoding="utf-8")

    def _read_commitment_file(self, project_id: str, commitment_id: str) -> str:
        """Read a specific commitment file's full contents."""
        file_path = self.memory._project_dir(project_id) / "commitments" / f"{commitment_id}.md"
        if not file_path.exists():
            return f"Commitment file not found: {commitment_id}"
        return file_path.read_text(encoding="utf-8")

    def _read_timeline(self, project_id: str) -> str:
        """Read the project timeline."""
        timeline_path = self.memory._project_dir(project_id) / "timeline.md"
        if not timeline_path.exists():
            return "No timeline found for this project."
        return timeline_path.read_text(encoding="utf-8")

    # ─── Contradiction detection ────────────────────────────

    def detect_contradictions(
        self,
        project_id: str,
    ) -> list[Contradiction]:
        """Detect contradictions across project commitments and meetings.

        Loads all commitments and their source meetings, then uses Opus 4.7
        with xhigh effort to reason about whether later statements implicitly
        or explicitly contradict earlier ones.

        This replaces the stub in ProjectMemory.find_contradictions().

        Args:
            project_id: The project slug.

        Returns:
            List of Contradiction objects. Empty if no contradictions found.

        Raises:
            anthropic.APIError: on API failures.
        """
        logger.info("Archivist detecting contradictions for project=%s", project_id)

        # Reset token counter for this invocation
        self.total_tokens_used = 0

        # Load all commitments and meetings into a single context block.
        # For contradiction detection, we need the full picture — selective
        # reading won't work because we're comparing everything against everything.
        context = self._build_contradiction_context(project_id)

        if not context.strip():
            logger.info("No commitments or meetings to check for contradictions")
            return []

        # Single deep-reasoning call with forced tool output
        # NOTE: thinking + forced tool_choice is not allowed by the API.
        # For contradiction detection we prioritize structured output
        # over adaptive thinking.
        response = self.client.messages.create(
            model=MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=self.system_prompt,
            tools=[REPORT_CONTRADICTIONS_TOOL],
            tool_choice={"type": "tool", "name": "report_contradictions"},
            messages=[
                {
                    "role": "user",
                    "content": (
                        "## Contradiction Detection Task\n\n"
                        "Analyze all commitments and meeting records below. "
                        "Identify any cases where a later meeting implicitly or "
                        "explicitly contradicts, walks back, or changes a commitment "
                        "from an earlier meeting WITHOUT acknowledging the change.\n\n"
                        "An acknowledged revision ('we adjusted from 50 to 42 because...') "
                        "is NOT a contradiction. An unacknowledged change ('we've made "
                        "good progress on the 42 AgriMart rollout' when 50 was committed) "
                        "IS a contradiction.\n\n"
                        f"{context}"
                    ),
                }
            ],
        )

        # Track real token usage from response.usage
        self.total_tokens_used += response.usage.input_tokens + response.usage.output_tokens

        return self._parse_contradictions_response(response)

    def _build_contradiction_context(self, project_id: str) -> str:
        """Build a text context of all meetings and commitments for contradiction analysis.

        Args:
            project_id: The project slug.

        Returns:
            Formatted text with all meetings and commitments.
        """
        sections: list[str] = []

        # Load all meetings with their full MoM bodies
        meetings_dir = self.memory._project_dir(project_id) / "meetings"
        if meetings_dir.exists():
            for path in sorted(meetings_dir.glob("*.md")):
                content = path.read_text(encoding="utf-8")
                sections.append(
                    f"### File: meetings/{path.name}\n\n{content}\n"
                )

        # Load all commitments
        commitments_dir = self.memory._project_dir(project_id) / "commitments"
        if commitments_dir.exists():
            for path in sorted(commitments_dir.glob("*.md")):
                content = path.read_text(encoding="utf-8")
                sections.append(
                    f"### File: commitments/{path.name}\n\n{content}\n"
                )

        return "\n---\n\n".join(sections)

    @staticmethod
    def _parse_contradictions_response(
        response: anthropic.types.Message,
    ) -> list[Contradiction]:
        """Parse the contradiction detection response.

        Args:
            response: API response with report_contradictions tool use.

        Returns:
            List of Contradiction objects.

        Raises:
            ValueError: if the response format is unexpected.
        """
        for block in response.content:
            if block.type == "tool_use" and block.name == "report_contradictions":
                tool_input = block.input
                if not isinstance(tool_input, dict):
                    raise ValueError(
                        f"report_contradictions tool input is not a dict: {type(tool_input)}"
                    )

                raw_contradictions = tool_input.get("contradictions", [])
                return [Contradiction(**c) for c in raw_contradictions]

        content_types = [block.type for block in response.content]
        raise ValueError(
            f"Expected report_contradictions tool use in response, "
            f"but got content types: {content_types}."
        )
