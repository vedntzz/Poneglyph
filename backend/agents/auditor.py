"""Auditor agent — adversarial self-verification of draft report claims.

Takes a DraftSection from Drafter, re-reads every cited source independently,
and tags each claim as VERIFIED, CONTESTED, or UNSUPPORTED. For image-sourced
evidence with MEDIUM or LOW confidence, makes an independent Opus 4.7 vision
call against the original image (not Scout's extraction).

This is the showcase for Opus 4.7's self-verification capability: the model
re-reads its own system's output critically and catches errors that earlier
models would propagate. See CAPABILITIES.md#self-verification.

Key design decisions:
- Adversarial posture: the prompt instructs Auditor to assume claims are
  wrong until evidence forces otherwise.
- Independent vision: for MEDIUM/LOW confidence image evidence, Auditor
  loads the full original image and re-verifies — not Scout's raw_text.
  This avoids circular verification (Scout checking Scout).
- Cost optimization: HIGH confidence image evidence trusts raw_text.
  ~80% of claims stay cheap, ~20% get the independent vision call.
  See sessions/005-drafter-auditor.md for the tradeoff documentation.
- Full image, not cropped bbox: Scout's claims often draw on broader
  document context (header + body). Cropping to bbox loses context.
  See sessions/003-scout.md retro.

See prompts/auditor.md, CAPABILITIES.md#self-verification.
"""

from __future__ import annotations

import base64
import logging
import mimetypes
import os
from enum import Enum
from pathlib import Path
from typing import Any

import anthropic
from pydantic import BaseModel, Field

from agents.drafter import Claim, DraftSection
from memory.models import Confidence, Evidence
from memory.project_memory import ProjectMemory

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MODEL = "claude-opus-4-7"

MAX_OUTPUT_TOKENS = 16_000


# ─────────────────────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────────────────────

class VerificationTag(str, Enum):
    """Auditor's verdict on a single claim. See CLAUDE.md § demo flow step 9."""

    VERIFIED = "verified"           # ✓ — source directly supports the claim
    CONTESTED = "contested"         # ⚠ — partial support or conflicting sources
    UNSUPPORTED = "unsupported"     # ✗ — source doesn't support or doesn't exist


class VerifiedClaim(BaseModel):
    """A claim after Auditor verification."""

    text: str = Field(description="The original claim text.")
    citation_ids: list[str] = Field(description="Original source IDs.")
    source_type: str = Field(description="Original source type.")
    tag: VerificationTag = Field(description="Auditor's verification verdict.")
    reason: str = Field(
        default="",
        description="Explanation for CONTESTED or UNSUPPORTED. Empty for VERIFIED.",
    )
    used_vision: bool = Field(
        default=False,
        description="Whether an independent vision call was made for this claim.",
    )


class VerifiedSection(BaseModel):
    """A fully verified report section — the final output of the pipeline."""

    section_name: str = Field(description="Section title.")
    donor_format: str = Field(description="Donor format.")
    verified_claims: list[VerifiedClaim] = Field(description="Claims with verification tags.")
    rendered_markdown: str = Field(description="Original rendered markdown from Drafter.")
    summary: str = Field(
        default="",
        description="Verification summary: counts of ✓, ⚠, ✗.",
    )


# ─────────────────────────────────────────────────────────────
# Tool definitions
# ─────────────────────────────────────────────────────────────

# Memory-reading tools — Auditor reads sources independently.
MEMORY_TOOLS: list[dict[str, Any]] = [
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
]

VERIFY_CLAIMS_TOOL: dict[str, Any] = {
    "name": "verify_claims",
    "description": (
        "Submit verification results for all claims. Call this ONLY after "
        "you have read and verified every cited source."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "verified_claims": {
                "type": "array",
                "description": "Each claim with its verification tag and reason.",
                "items": {
                    "type": "object",
                    "properties": {
                        "claim_index": {
                            "type": "integer",
                            "description": "0-based index of the claim in the input list.",
                        },
                        "tag": {
                            "type": "string",
                            "enum": ["verified", "contested", "unsupported"],
                            "description": "Verification verdict.",
                        },
                        "reason": {
                            "type": "string",
                            "description": (
                                "Explanation for CONTESTED or UNSUPPORTED. "
                                "Empty string for VERIFIED."
                            ),
                        },
                    },
                    "required": ["claim_index", "tag", "reason"],
                },
            },
        },
        "required": ["verified_claims"],
    },
}


# ─────────────────────────────────────────────────────────────
# AuditorAgent
# ─────────────────────────────────────────────────────────────

class AuditorAgent:
    """Adversarial self-verification of draft report claims.

    Re-reads every cited source independently and tags each claim as
    VERIFIED, CONTESTED, or UNSUPPORTED. For image-sourced evidence with
    MEDIUM/LOW confidence, makes an independent vision call.

    This showcases Opus 4.7's self-verification capability.
    See CAPABILITIES.md#self-verification.

    Args:
        memory: The ProjectMemory instance to read sources from.
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

    @staticmethod
    def _load_system_prompt() -> str:
        """Load the Auditor system prompt from /prompts/auditor.md."""
        prompt_path = Path(__file__).resolve().parent.parent.parent / "prompts" / "auditor.md"
        if not prompt_path.exists():
            raise FileNotFoundError(
                f"Auditor system prompt not found at {prompt_path}. "
                f"Expected a file at /prompts/auditor.md relative to the repo root."
            )
        return prompt_path.read_text(encoding="utf-8")

    def verify(
        self,
        project_id: str,
        draft: DraftSection,
    ) -> VerifiedSection:
        """Verify all claims in a draft section against project memory.

        Two-phase verification:
        1. Pre-scan: identify which claims cite image evidence with MEDIUM/LOW
           confidence and run independent vision calls for those.
        2. Main verification: send all claims + source data to Opus 4.7 for
           adversarial review with structured verdict output.

        Args:
            project_id: The project slug.
            draft: The DraftSection to verify.

        Returns:
            VerifiedSection with tags on every claim.

        Raises:
            anthropic.APIError: on API failures.
        """
        if not draft.claims:
            return VerifiedSection(
                section_name=draft.section_name,
                donor_format=draft.donor_format,
                verified_claims=[],
                rendered_markdown=draft.rendered_markdown,
                summary="No claims to verify.",
            )

        logger.info(
            "Auditor verifying %d claims for project=%s, section='%s'",
            len(draft.claims), project_id, draft.section_name,
        )

        # Phase 1: independent vision verification for MEDIUM/LOW image evidence
        vision_results = self._run_vision_checks(project_id, draft.claims)

        # Phase 2: main verification pass with agentic tool use
        verified_claims = self._run_main_verification(
            project_id, draft, vision_results
        )

        # Build summary
        verified_count = sum(1 for c in verified_claims if c.tag == VerificationTag.VERIFIED)
        contested_count = sum(1 for c in verified_claims if c.tag == VerificationTag.CONTESTED)
        unsupported_count = sum(1 for c in verified_claims if c.tag == VerificationTag.UNSUPPORTED)
        vision_count = sum(1 for c in verified_claims if c.used_vision)

        summary = (
            f"{verified_count} verified (✓), {contested_count} contested (⚠), "
            f"{unsupported_count} unsupported (✗). "
            f"{vision_count} claims checked via independent vision call."
        )

        logger.info("Auditor result: %s", summary)

        return VerifiedSection(
            section_name=draft.section_name,
            donor_format=draft.donor_format,
            verified_claims=verified_claims,
            rendered_markdown=draft.rendered_markdown,
            summary=summary,
        )

    # ─── Phase 1: Vision checks for MEDIUM/LOW evidence ────

    def _run_vision_checks(
        self,
        project_id: str,
        claims: list[Claim],
    ) -> dict[int, str]:
        """Run independent vision verification for claims citing MEDIUM/LOW image evidence.

        For HIGH confidence image evidence, we trust Scout's raw_text. For
        MEDIUM/LOW, we load the full original image and ask Opus 4.7 to
        independently read what it says. This is NOT Scout checking Scout —
        it's Auditor forming its own judgment.

        Cost tradeoff: ~80% of claims skip this (HIGH confidence or non-image
        sources). ~20% get the independent vision call where it matters most.
        See sessions/005-drafter-auditor.md.

        Args:
            project_id: The project slug.
            claims: List of claims from the draft.

        Returns:
            Dict mapping claim index → vision verification result text.
            Only includes claims that got a vision check.
        """
        vision_results: dict[int, str] = {}

        for idx, claim in enumerate(claims):
            if claim.source_type != "evidence":
                continue

            # Check each cited evidence item
            for citation_id in claim.citation_ids:
                evidence = self._load_evidence(project_id, citation_id)
                if evidence is None:
                    continue

                should_vision_check = (
                    evidence.source_file is not None
                    and evidence.confidence in (Confidence.MEDIUM, Confidence.LOW)
                )

                if not should_vision_check:
                    continue

                # Independent vision call on the full original image
                # CRITICAL: load FULL image, not cropped bbox. See
                # sessions/003-scout.md retro — Scout's claims draw on
                # broader document context than the single bbox.
                vision_result = self._verify_claim_against_image(
                    claim.text, evidence.source_file
                )

                if vision_result is not None:
                    vision_results[idx] = vision_result
                    logger.info(
                        "Auditor vision-checked claim %d against %s (confidence: %s)",
                        idx, evidence.source_file, evidence.confidence.value,
                    )

        return vision_results

    def _load_evidence(
        self,
        project_id: str,
        evidence_id: str,
    ) -> Evidence | None:
        """Load an evidence item from memory, returning None if not found."""
        evidence_list = self.memory.read_all_evidence(project_id)
        for ev in evidence_list:
            if ev.evidence_id == evidence_id:
                return ev
        return None

    def _verify_claim_against_image(
        self,
        claim_text: str,
        source_file: str,
    ) -> str | None:
        """Make an independent Opus 4.7 vision call to verify a claim.

        Loads the FULL original image and asks whether the claim is
        supported by what's visible in the document.

        Args:
            claim_text: The claim to verify.
            source_file: Path to the original image file.

        Returns:
            Vision verification result text, or None if image can't be loaded.
        """
        image_path = Path(source_file)
        if not image_path.exists():
            logger.warning("Image file not found for vision check: %s", source_file)
            return None

        image_bytes = image_path.read_bytes()
        if not image_bytes:
            return None

        mime_type, _ = mimetypes.guess_type(source_file)
        if mime_type is None:
            mime_type = "image/png"

        base64_image = base64.b64encode(image_bytes).decode("utf-8")

        # Opus 4.7 vision call for independent verification
        # See CAPABILITIES.md#self-verification, CAPABILITIES.md#pixel-vision
        # NOTE: thinking + forced tool_choice conflict (sessions/003-scout.md).
        # We use adaptive thinking here without forced tool_choice.
        try:
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=2_000,
                thinking={"type": "adaptive"},
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": mime_type,
                                    "data": base64_image,
                                },
                            },
                            {
                                "type": "text",
                                "text": (
                                    f"I need to verify this claim against the document image:\n\n"
                                    f"CLAIM: \"{claim_text}\"\n\n"
                                    f"Read the document image carefully. Does the document "
                                    f"support this specific claim? Be precise about numbers, "
                                    f"names, dates, and attributions. If the claim is not "
                                    f"supported or only partially supported, explain exactly "
                                    f"what the document actually says versus what the claim states."
                                ),
                            },
                        ],
                    }
                ],
            )

            # Extract text response
            for block in response.content:
                if block.type == "text":
                    return block.text

        except anthropic.APIError as e:
            logger.error("Vision check failed: %s", e)

        return None

    # ─── Phase 2: Main verification pass ────────────────────

    def _run_main_verification(
        self,
        project_id: str,
        draft: DraftSection,
        vision_results: dict[int, str],
    ) -> list[VerifiedClaim]:
        """Run the main Auditor verification with agentic tool use.

        Sends all claims to Opus 4.7 with access to memory-reading tools.
        The model reads each cited source and renders a verdict.

        Args:
            project_id: The project slug.
            draft: The DraftSection to verify.
            vision_results: Pre-computed vision check results (claim index → text).

        Returns:
            List of VerifiedClaim objects.
        """
        # Format claims for the model
        claims_text = self._format_claims_for_verification(draft.claims, vision_results)

        all_tools = MEMORY_TOOLS + [VERIFY_CLAIMS_TOOL]

        messages: list[dict[str, Any]] = [
            {
                "role": "user",
                "content": (
                    f"## Verification Task\n\n"
                    f"Verify every claim in this draft report section. For each claim:\n"
                    f"1. Read the cited source file(s) using the tools provided\n"
                    f"2. Compare the claim against the actual source content\n"
                    f"3. Assign a tag: VERIFIED, CONTESTED, or UNSUPPORTED\n"
                    f"4. For CONTESTED/UNSUPPORTED, explain the specific discrepancy\n\n"
                    f"Project ID: {project_id}\n\n"
                    f"## Claims to Verify\n\n{claims_text}\n\n"
                    f"Read each cited source, then call verify_claims with your verdicts."
                ),
            }
        ]

        # Agentic loop: model reads sources, then produces verdicts
        max_rounds = 10
        for round_num in range(max_rounds):
            # Opus 4.7 adaptive thinking for adversarial reasoning
            # See CAPABILITIES.md#self-verification
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=MAX_OUTPUT_TOKENS,
                system=self.system_prompt,
                tools=all_tools,
                thinking={"type": "adaptive"},
                messages=messages,
            )

            # Check for final verification result
            result = self._check_for_verification(response, draft, vision_results)
            if result is not None:
                logger.info("Auditor completed verification in %d rounds", round_num + 1)
                return result

            # Process tool calls
            tool_results = self._process_tool_calls(response, project_id)

            if not tool_results:
                logger.warning("Auditor produced no tool calls and no verification")
                return self._default_unsupported(draft.claims)

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

        logger.warning("Auditor hit max rounds without completing")
        return self._default_unsupported(draft.claims)

    def _format_claims_for_verification(
        self,
        claims: list[Claim],
        vision_results: dict[int, str],
    ) -> str:
        """Format claims as numbered text for the verification prompt.

        Includes vision check results inline for claims that had them.
        """
        lines: list[str] = []
        for idx, claim in enumerate(claims):
            citations = ", ".join(claim.citation_ids) if claim.citation_ids else "none"
            lines.append(
                f"**Claim {idx}** (source type: {claim.source_type}, "
                f"citations: [{citations}]):\n"
                f"\"{claim.text}\""
            )

            if idx in vision_results:
                lines.append(
                    f"\n*Independent vision check result for claim {idx}:*\n"
                    f"{vision_results[idx]}"
                )

            lines.append("")

        return "\n".join(lines)

    def _check_for_verification(
        self,
        response: anthropic.types.Message,
        draft: DraftSection,
        vision_results: dict[int, str],
    ) -> list[VerifiedClaim] | None:
        """Check if the response contains a verify_claims tool call."""
        for block in response.content:
            if block.type == "tool_use" and block.name == "verify_claims":
                tool_input = block.input
                if not isinstance(tool_input, dict):
                    continue

                raw_results = tool_input.get("verified_claims", [])

                # Build VerifiedClaim objects by matching to original claims
                verified: list[VerifiedClaim] = []
                for raw in raw_results:
                    claim_idx = raw.get("claim_index", 0)
                    if claim_idx < len(draft.claims):
                        original = draft.claims[claim_idx]
                        verified.append(VerifiedClaim(
                            text=original.text,
                            citation_ids=original.citation_ids,
                            source_type=original.source_type,
                            tag=VerificationTag(raw.get("tag", "unsupported")),
                            reason=raw.get("reason", ""),
                            used_vision=claim_idx in vision_results,
                        ))

                # If model returned fewer results than claims, mark the rest unsupported
                covered_indices = {r.get("claim_index", -1) for r in raw_results}
                for idx, claim in enumerate(draft.claims):
                    if idx not in covered_indices:
                        verified.append(VerifiedClaim(
                            text=claim.text,
                            citation_ids=claim.citation_ids,
                            source_type=claim.source_type,
                            tag=VerificationTag.UNSUPPORTED,
                            reason="Auditor did not return a verdict for this claim.",
                            used_vision=idx in vision_results,
                        ))

                return verified

        return None

    def _process_tool_calls(
        self,
        response: anthropic.types.Message,
        project_id: str,
    ) -> list[dict[str, Any]]:
        """Execute memory-reading tool calls."""
        results: list[dict[str, Any]] = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            if block.name == "verify_claims":
                continue

            tool_output = self._execute_tool(block.name, block.input or {}, project_id)
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": tool_output,
            })
        return results

    def _execute_tool(
        self,
        tool_name: str,
        tool_input: dict[str, Any],
        project_id: str,
    ) -> str:
        """Execute a memory-reading tool."""
        if tool_name == "read_evidence_file":
            eid = tool_input.get("evidence_id", "")
            path = self.memory._project_dir(project_id) / "evidence" / f"{eid}.md"
            if not path.exists():
                return f"Evidence file not found: {eid}"
            return path.read_text(encoding="utf-8")
        elif tool_name == "read_meeting_file":
            mid = tool_input.get("meeting_id", "")
            path = self.memory._project_dir(project_id) / "meetings" / f"{mid}.md"
            if not path.exists():
                return f"Meeting file not found: {mid}"
            return path.read_text(encoding="utf-8")
        elif tool_name == "read_commitment_file":
            cid = tool_input.get("commitment_id", "")
            path = self.memory._project_dir(project_id) / "commitments" / f"{cid}.md"
            if not path.exists():
                return f"Commitment file not found: {cid}"
            return path.read_text(encoding="utf-8")
        else:
            return f"Unknown tool: {tool_name}"

    @staticmethod
    def _default_unsupported(claims: list[Claim]) -> list[VerifiedClaim]:
        """Return all claims as UNSUPPORTED — fallback when verification fails."""
        return [
            VerifiedClaim(
                text=c.text,
                citation_ids=c.citation_ids,
                source_type=c.source_type,
                tag=VerificationTag.UNSUPPORTED,
                reason="Verification could not be completed.",
            )
            for c in claims
        ]
