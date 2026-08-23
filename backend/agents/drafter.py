"""Drafter agent — writes donor-format report sections with source attribution.

Takes evidence, meetings, and commitments from the project binder and writes
a report section in the donor's specific voice and format. Each sentence is
a structured Claim with source IDs, so the Auditor can verify every fact.

Key design decisions:
- Dual output: List[Claim] internally (for Auditor), rendered markdown
  externally (for PM/donor). Both come from the same LLM call.
- Tool-use-driven memory access: same pattern as Archivist — model
  decides what to read from the project binder.
- Donor templates: short reference files that set voice, tone, and structure.
  World Bank is the primary format for the hackathon demo.

See prompts/drafter.md, CAPABILITIES.md#adaptive-thinking.
"""

from __future__ import annotations

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
from memory.project_memory import ProjectMemory

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MODEL = "claude-opus-4-7"

# Reports can be long; allow generous output.
MAX_OUTPUT_TOKENS = 16_000

# Maximum tool-use rounds for reading memory before writing.
MAX_TOOL_ROUNDS = 8

# Supported donor formats. World Bank is the primary; others are stubs.
SUPPORTED_DONOR_FORMATS = {"world_bank", "giz", "nabard"}

# Path to donor templates relative to this file.
TEMPLATES_DIR = Path(__file__).resolve().parent / "donor_templates"


# ─────────────────────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────────────────────

class Claim(BaseModel):
    """A single factual claim in the draft, traceable to sources.

    The Auditor iterates over these to verify each one independently.
    """

    text: str = Field(description="The claim sentence as it appears in the report.")
    citation_ids: list[str] = Field(
        description="Source IDs from the project binder (evidence, meeting, or commitment IDs).",
    )
    source_type: str = Field(
        description="Type of primary source: 'evidence', 'meeting', 'commitment', or 'logframe'.",
    )


class DraftSection(BaseModel):
    """A drafted report section with structured claims and rendered markdown."""

    section_name: str = Field(description="Section title, e.g. 'Output 3.2: Women's PHM Training'.")
    donor_format: str = Field(description="Donor format used, e.g. 'world_bank'.")
    claims: list[Claim] = Field(description="Structured claims for Auditor verification.")
    rendered_markdown: str = Field(description="The report section as markdown with inline citations.")
    gaps: list[str] = Field(
        default_factory=list,
        description="Information gaps identified during drafting.",
    )


# ─────────────────────────────────────────────────────────────
# Memory-reading tools — same pattern as Archivist
# ─────────────────────────────────────────────────────────────

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
]

# Tool for structured draft output
DRAFT_SECTION_TOOL: dict[str, Any] = {
    "name": "draft_section",
    "description": (
        "Submit the complete draft report section with structured claims "
        "and rendered markdown. Call this ONLY after reading all relevant files."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "section_name": {
                "type": "string",
                "description": "Section title matching the indicator.",
            },
            "claims": {
                "type": "array",
                "description": "Structured claims, each with text, source IDs, and source type.",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "The claim sentence.",
                        },
                        "citation_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Source IDs (evidence, meeting, or commitment IDs).",
                        },
                        "source_type": {
                            "type": "string",
                            "enum": ["evidence", "meeting", "commitment", "logframe"],
                            "description": "Type of primary source.",
                        },
                    },
                    "required": ["text", "citation_ids", "source_type"],
                },
            },
            "rendered_markdown": {
                "type": "string",
                "description": (
                    "The complete report section as markdown, with inline "
                    "citation markers like [mtg-abc123] or [ev-def456]."
                ),
            },
            "gaps": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Information gaps found during drafting.",
            },
        },
        "required": ["section_name", "claims", "rendered_markdown"],
    },
}


# ─────────────────────────────────────────────────────────────
# DrafterAgent
# ─────────────────────────────────────────────────────────────

class DrafterAgent:
    """Write donor-format report sections with source-attributed claims.

    Reads the project binder via tool use, then produces a DraftSection
    with both structured claims (for Auditor) and rendered markdown (for PM).

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
        # Read by the Orchestrator after run() to emit real budget data via SSE.
        self.total_tokens_used: int = 0

    @staticmethod
    def _load_system_prompt() -> str:
        """Load the Drafter system prompt from /prompts/drafter.md."""
        prompt_path = Path(__file__).resolve().parent.parent.parent / "prompts" / "drafter.md"
        if not prompt_path.exists():
            raise FileNotFoundError(
                f"Drafter system prompt not found at {prompt_path}. "
                f"Expected a file at /prompts/drafter.md relative to the repo root."
            )
        return prompt_path.read_text(encoding="utf-8")

    @staticmethod
    def _load_donor_template(donor_format: str) -> str:
        """Load the donor format template.

        Args:
            donor_format: Donor slug, e.g. 'world_bank'.

        Returns:
            Template text. Falls back to World Bank if format not found.
        """
        template_path = TEMPLATES_DIR / f"{donor_format}.md"
        if not template_path.exists():
            # Fall back to World Bank template for unsupported formats
            template_path = TEMPLATES_DIR / "world_bank.md"
        if not template_path.exists():
            return "(No donor template available.)"
        return template_path.read_text(encoding="utf-8")

    def run(
        self,
        project_id: str,
        section_name: str,
        donor_format: str = "world_bank",
    ) -> DraftSection:
        """Draft a report section by reading the project binder and writing in donor format.

        Runs an agentic loop: reads relevant memory files via tool use, then
        produces a structured DraftSection.

        Args:
            project_id: The project slug.
            section_name: Report section title, e.g. "Progress on Women's Training".
            donor_format: Donor slug. Defaults to 'world_bank'.

        Returns:
            DraftSection with structured claims and rendered markdown.

        Raises:
            ValueError: if section_name is empty.
            anthropic.APIError: on API failures.
        """
        if not section_name.strip():
            raise ValueError("Section name is empty.")

        logger.info(
            "Drafter writing section '%s' for project=%s (format: %s)",
            section_name, project_id, donor_format,
        )

        # Reset token counter for this run invocation
        self.total_tokens_used = 0

        donor_template = self._load_donor_template(donor_format)
        all_tools = MEMORY_TOOLS + [DRAFT_SECTION_TOOL]

        # Opus 4.7 agentic loop: read binder, then draft
        # Uses adaptive thinking for cross-document synthesis.
        # See CAPABILITIES.md#adaptive-thinking.
        messages: list[dict[str, Any]] = [
            {
                "role": "user",
                "content": (
                    f"## Task\n\n"
                    f"Write a report section titled \"{section_name}\" for project "
                    f"**{project_id}** in **{donor_format}** format.\n\n"
                    f"## Donor Format Template\n\n{donor_template}\n\n"
                    f"## Instructions\n\n"
                    f"1. First, list the available evidence, meetings, and commitments.\n"
                    f"2. Read the logframe to understand the target indicators.\n"
                    f"3. Read the specific files relevant to this section.\n"
                    f"4. Write the section following the donor template structure.\n"
                    f"5. Every factual claim must cite a source ID.\n"
                    f"6. Call draft_section with your complete output."
                ),
            }
        ]

        for round_num in range(MAX_TOOL_ROUNDS):
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

            # Check for final draft output
            draft = self._check_for_draft(response, donor_format)
            if draft is not None:
                logger.info(
                    "Drafter completed in %d rounds: %d claims, %d gaps",
                    round_num + 1, len(draft.claims), len(draft.gaps),
                )
                return draft

            # Process tool calls
            tool_results = self._process_tool_calls(response, project_id)

            if not tool_results:
                logger.warning("Drafter produced no tool calls and no draft, forcing stop")
                return DraftSection(
                    section_name=section_name,
                    donor_format=donor_format,
                    claims=[],
                    rendered_markdown="(Draft could not be generated — no relevant data found.)",
                    gaps=["No files read from project binder."],
                )

            # Build conversation for next round
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

        logger.warning("Drafter hit max rounds (%d) without completing", MAX_TOOL_ROUNDS)
        return DraftSection(
            section_name=section_name,
            donor_format=donor_format,
            claims=[],
            rendered_markdown="(Draft incomplete — exceeded maximum tool-use rounds.)",
            gaps=["Drafting did not complete within allowed rounds."],
        )

    def _check_for_draft(
        self,
        response: anthropic.types.Message,
        donor_format: str,
    ) -> DraftSection | None:
        """Check if the response contains a completed draft_section tool call."""
        for block in response.content:
            if block.type == "tool_use" and block.name == "draft_section":
                tool_input = block.input
                if not isinstance(tool_input, dict):
                    continue

                claims = [Claim(**c) for c in tool_input.get("claims", [])]
                return DraftSection(
                    section_name=tool_input.get("section_name", ""),
                    donor_format=donor_format,
                    claims=claims,
                    rendered_markdown=tool_input.get("rendered_markdown", ""),
                    gaps=tool_input.get("gaps", []),
                )
        return None

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
            if block.name == "draft_section":
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

        Same implementation as Archivist — reads from ProjectMemory.
        """
        if tool_name == "list_evidence":
            return self._list_evidence(project_id)
        elif tool_name == "list_meetings":
            return self._list_meetings(project_id)
        elif tool_name == "list_commitments":
            return self._list_commitments(project_id)
        elif tool_name == "read_evidence_file":
            return self._read_file(project_id, "evidence", tool_input.get("evidence_id", ""))
        elif tool_name == "read_meeting_file":
            return self._read_file(project_id, "meetings", tool_input.get("meeting_id", ""))
        elif tool_name == "read_commitment_file":
            return self._read_file(project_id, "commitments", tool_input.get("commitment_id", ""))
        elif tool_name == "read_logframe":
            return self._read_logframe(project_id)
        else:
            return f"Unknown tool: {tool_name}"

    def _list_evidence(self, project_id: str) -> str:
        """List all evidence items."""
        evidence_list = self.memory.read_all_evidence(project_id)
        if not evidence_list:
            return "No evidence files found."
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
        """List all meetings."""
        meetings = self.memory.read_all_meetings(project_id)
        if not meetings:
            return "No meeting records found."
        lines = [f"Found {len(meetings)} meetings:\n"]
        for mtg in meetings:
            lines.append(
                f"- {mtg.meeting_id} | {mtg.date} | {len(mtg.attendees)} attendees | "
                f"{len(mtg.decisions)} decisions"
            )
        return "\n".join(lines)

    def _list_commitments(self, project_id: str) -> str:
        """List all commitments."""
        commitments = self.memory.read_all_commitments(project_id)
        if not commitments:
            return "No commitments found."
        lines = [f"Found {len(commitments)} commitments:\n"]
        for cmt in commitments:
            due = cmt.due_date or "no deadline"
            lines.append(
                f"- {cmt.commitment_id} | owner: {cmt.owner} | due: {due} | "
                f"{cmt.description[:100]}"
            )
        return "\n".join(lines)

    def _read_file(self, project_id: str, subdir: str, file_id: str) -> str:
        """Read a specific file from a project binder subdirectory."""
        file_path = self.memory._project_dir(project_id) / subdir / f"{file_id}.md"
        if not file_path.exists():
            return f"File not found: {subdir}/{file_id}.md"
        return file_path.read_text(encoding="utf-8")

    def _read_logframe(self, project_id: str) -> str:
        """Read the project logframe."""
        logframe_path = self.memory._project_dir(project_id) / "logframe.md"
        if not logframe_path.exists():
            return "No logframe found."
        return logframe_path.read_text(encoding="utf-8")
