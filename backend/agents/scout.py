"""Scout agent — extracts structured evidence from document images.

Uses Opus 4.7's pixel-coordinate vision (shipped April 16, 2026) to read
scanned documents, field forms, and photos, returning structured evidence
with bounding boxes in the image's native pixel space.

Key design decisions:
- Tool-forced output: we define a `record_evidence` tool and set
  tool_choice to force its use, rather than asking for JSON in prose.
  This gives us schema-validated structured output reliably.
- xhigh effort: evidence extraction from messy handwritten forms
  benefits from Opus 4.7's extended reasoning at the highest effort level.
- No downsampling: we send images at full resolution because 4.7's
  high-res vision (up to 3.75 MP) is the whole point.

See CAPABILITIES.md#pixel-vision, prompts/scout.md.
"""

from __future__ import annotations

import base64
import json
import logging
import mimetypes
import os
import uuid
from pathlib import Path
from typing import Any

import anthropic

from memory.models import (
    Confidence,
    Evidence,
    EvidenceSource,
    VerificationStatus,
)
from memory.project_memory import ProjectMemory

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MODEL = "claude-opus-4-7"

# Maximum tokens for Scout's response. Evidence extraction rarely needs
# more than 4k, but we leave headroom for images with dense text.
MAX_OUTPUT_TOKENS = 8_000

# Map from Scout's source_type strings to the EvidenceSource enum.
# Scout returns these via the tool schema; we convert on our side.
SOURCE_TYPE_MAP: dict[str, EvidenceSource] = {
    "field_form": EvidenceSource.FIELD_FORM,
    "photo": EvidenceSource.PHOTO,
    "crm_export": EvidenceSource.CRM_EXPORT,
    "whatsapp": EvidenceSource.WHATSAPP,
    "email": EvidenceSource.EMAIL,
    "meeting_transcript": EvidenceSource.MEETING_TRANSCRIPT,
    "government_record": EvidenceSource.GOVERNMENT_RECORD,
    "other": EvidenceSource.OTHER,
}

CONFIDENCE_MAP: dict[str, Confidence] = {
    "high": Confidence.HIGH,
    "medium": Confidence.MEDIUM,
    "low": Confidence.LOW,
}

# ─────────────────────────────────────────────────────────────
# Tool definition — forces structured output from Opus 4.7
# ─────────────────────────────────────────────────────────────

# We force tool use rather than asking for JSON in prose because
# Opus 4.7 follows tool schemas more reliably than prose JSON,
# especially for deeply nested structured output with bounding boxes.
RECORD_EVIDENCE_TOOL: dict[str, Any] = {
    "name": "record_evidence",
    "description": (
        "Record all evidence items extracted from the document image. "
        "Call this exactly once per image with all found evidence items."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "evidence_items": {
                "type": "array",
                "description": (
                    "List of evidence items found in the image. "
                    "Empty array if no evidence found."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "raw_text": {
                            "type": "string",
                            "description": (
                                "Verbatim text extracted from the image, "
                                "in the original language of the document."
                            ),
                        },
                        "interpreted_claim": {
                            "type": "string",
                            "description": (
                                "What this evidence means for the project, "
                                "stated as a factual claim in English."
                            ),
                        },
                        "logframe_indicator": {
                            "type": ["string", "null"],
                            "description": (
                                "Which logframe indicator this evidence supports, "
                                "e.g. 'Output 2.1'. Null if no clear match."
                            ),
                        },
                        "confidence": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                            "description": "Confidence in the extraction accuracy.",
                        },
                        "bounding_box": {
                            "type": "object",
                            "description": (
                                "Pixel-coordinate bounding box in the image's native "
                                "pixel space. (x1,y1) is top-left, (x2,y2) is bottom-right."
                            ),
                            "properties": {
                                "x1": {
                                    "type": "integer",
                                    "description": "Left edge x-coordinate in pixels.",
                                },
                                "y1": {
                                    "type": "integer",
                                    "description": "Top edge y-coordinate in pixels.",
                                },
                                "x2": {
                                    "type": "integer",
                                    "description": "Right edge x-coordinate in pixels.",
                                },
                                "y2": {
                                    "type": "integer",
                                    "description": "Bottom edge y-coordinate in pixels.",
                                },
                            },
                            "required": ["x1", "y1", "x2", "y2"],
                        },
                        "source_type": {
                            "type": "string",
                            "enum": [
                                "field_form",
                                "photo",
                                "crm_export",
                                "whatsapp",
                                "email",
                                "meeting_transcript",
                                "government_record",
                                "other",
                            ],
                            "description": "Classification of the document type.",
                        },
                        "date_collected": {
                            "type": ["string", "null"],
                            "description": (
                                "Date mentioned in the document, ISO 8601 format "
                                "(YYYY-MM-DD). Null if no date found."
                            ),
                        },
                        "district": {
                            "type": ["string", "null"],
                            "description": "District name if mentioned in the document.",
                        },
                        "village": {
                            "type": ["string", "null"],
                            "description": "Village name if mentioned in the document.",
                        },
                    },
                    "required": [
                        "raw_text",
                        "interpreted_claim",
                        "confidence",
                        "bounding_box",
                        "source_type",
                    ],
                },
            },
            "notes": {
                "type": "string",
                "description": (
                    "Any notes about image quality, readability issues, or "
                    "reasons for low confidence. Optional."
                ),
            },
        },
        "required": ["evidence_items"],
    },
}


# ─────────────────────────────────────────────────────────────
# ScoutAgent
# ─────────────────────────────────────────────────────────────

class ScoutAgent:
    """Extract structured evidence from document images using Opus 4.7 vision.

    Scout reads scanned forms, field photos, and other visual documents,
    returning structured Evidence objects with pixel-coordinate bounding
    boxes. It uses tool-forced output for reliable structured extraction.

    Args:
        memory: The ProjectMemory instance to write evidence into.
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
        """Load the Scout system prompt from /prompts/scout.md.

        The prompt lives in a separate file so it's human-readable and
        reviewable outside of code. See CLAUDE.md § Rule 3.
        """
        # Walk up from /backend/agents/ to repo root, then into /prompts/
        prompt_path = Path(__file__).resolve().parent.parent.parent / "prompts" / "scout.md"
        if not prompt_path.exists():
            raise FileNotFoundError(
                f"Scout system prompt not found at {prompt_path}. "
                f"Expected a file at /prompts/scout.md relative to the repo root."
            )
        return prompt_path.read_text(encoding="utf-8")

    def run(
        self,
        project_id: str,
        image_source: str | bytes,
        logframe: str,
        source_file_path: str | None = None,
    ) -> list[Evidence]:
        """Extract evidence from a document image and persist to project memory.

        Args:
            project_id: The project slug in ProjectMemory.
            image_source: Either a file path (str) to an image, or raw image
                bytes. Images are sent at full resolution — do not downsample.
            logframe: The project's logframe as markdown text. Provided in
                every call so Scout can map evidence to indicators.
            source_file_path: Optional path to record as the evidence's
                source file. If image_source is a path, defaults to that.

        Returns:
            List of Evidence objects extracted from the image. Empty list if
            no evidence found. Each Evidence is also persisted to ProjectMemory.

        Raises:
            ValueError: if image_source is empty or an unsupported format.
            anthropic.APIError: on Anthropic API failures.
        """
        image_bytes, media_type = self._resolve_image(image_source)
        base64_image = base64.b64encode(image_bytes).decode("utf-8")

        # Default source_file_path to the image path if it's a string path
        if source_file_path is None and isinstance(image_source, str):
            source_file_path = image_source

        logger.info(
            "Scout processing image: %s bytes, %s, project=%s",
            len(image_bytes),
            media_type,
            project_id,
        )

        # Reset token counter for this run invocation
        self.total_tokens_used = 0

        # Opus 4.7 vision call with tool-forced structured output
        # See CAPABILITIES.md#pixel-vision, CLAUDE.md § Model parameters
        #
        # NOTE: thinking + forced tool_choice is not allowed by the API.
        # We prioritize forced tool use (reliable structured output) over
        # adaptive thinking. See sessions/003-scout.md.
        response = self.client.messages.create(
            model=MODEL,
            max_tokens=MAX_OUTPUT_TOKENS,
            system=self.system_prompt,
            tools=[RECORD_EVIDENCE_TOOL],
            # Force tool use so Scout always returns structured output
            tool_choice={"type": "tool", "name": "record_evidence"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64_image,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                f"## Project Logframe\n\n{logframe}\n\n---\n\n"
                                "Extract all evidence from this document image. "
                                "Map each piece of evidence to the logframe "
                                "indicators above where applicable."
                            ),
                        },
                    ],
                }
            ],
        )

        # Track real token usage from response.usage for budget countdown UI
        self.total_tokens_used += response.usage.input_tokens + response.usage.output_tokens

        # Parse the tool use response
        raw_items = self._parse_tool_response(response)

        # Convert to Evidence objects and persist
        evidence_list: list[Evidence] = []
        for item in raw_items:
            evidence = self._to_evidence(item, source_file_path)
            self.memory.add_evidence(project_id, evidence)
            evidence_list.append(evidence)
            logger.info(
                "Scout extracted: %s [%s] → %s",
                evidence.evidence_id,
                evidence.confidence,
                evidence.summary[:80],
            )

        logger.info(
            "Scout finished: %d evidence items from project=%s",
            len(evidence_list),
            project_id,
        )
        return evidence_list

    @staticmethod
    def _resolve_image(image_source: str | bytes) -> tuple[bytes, str]:
        """Resolve image source to (bytes, media_type).

        Args:
            image_source: File path or raw bytes.

        Returns:
            Tuple of (image_bytes, media_type string for the API).

        Raises:
            ValueError: if the image format is unsupported or file not found.
        """
        if isinstance(image_source, str):
            path = Path(image_source)
            if not path.exists():
                raise ValueError(f"Image file not found: {image_source}")
            image_bytes = path.read_bytes()
            mime_type, _ = mimetypes.guess_type(image_source)
        elif isinstance(image_source, bytes):
            image_bytes = image_source
            mime_type = None
        else:
            raise ValueError(
                f"image_source must be a file path (str) or bytes, got {type(image_source)}"
            )

        if not image_bytes:
            raise ValueError("Image is empty (0 bytes).")

        # Determine media type from MIME or magic bytes
        if mime_type is None:
            mime_type = _detect_media_type(image_bytes)

        supported = {"image/jpeg", "image/png", "image/webp", "image/gif"}
        if mime_type not in supported:
            raise ValueError(
                f"Unsupported image format: {mime_type}. "
                f"Supported: {', '.join(sorted(supported))}"
            )

        return image_bytes, mime_type

    @staticmethod
    def _parse_tool_response(response: anthropic.types.Message) -> list[dict[str, Any]]:
        """Extract evidence items from the Opus 4.7 tool use response.

        Args:
            response: The API response, expected to contain a tool_use block
                for the record_evidence tool.

        Returns:
            List of raw evidence item dicts from the tool input.

        Raises:
            ValueError: if the response doesn't contain the expected tool use.
        """
        for block in response.content:
            if block.type == "tool_use" and block.name == "record_evidence":
                tool_input = block.input
                if not isinstance(tool_input, dict):
                    raise ValueError(
                        f"record_evidence tool input is not a dict: {type(tool_input)}"
                    )
                items = tool_input.get("evidence_items", [])
                notes = tool_input.get("notes")
                if notes:
                    logger.info("Scout notes: %s", notes)
                return items

        # If we forced tool use and still got no tool_use block, something is wrong
        content_types = [block.type for block in response.content]
        raise ValueError(
            f"Expected record_evidence tool use in response, "
            f"but got content types: {content_types}. "
            f"This should not happen with tool_choice forced."
        )

    @staticmethod
    def _to_evidence(
        raw: dict[str, Any],
        source_file_path: str | None,
    ) -> Evidence:
        """Convert a raw tool output dict to an Evidence Pydantic model.

        Args:
            raw: Dict from the record_evidence tool's evidence_items array.
            source_file_path: Path to the original image file.

        Returns:
            An Evidence object ready for ProjectMemory.
        """
        # Generate a unique evidence ID
        short_id = uuid.uuid4().hex[:8]
        evidence_id = f"ev-{short_id}"

        # Map source_type string to enum
        source_type_str = raw.get("source_type", "other")
        source = SOURCE_TYPE_MAP.get(source_type_str, EvidenceSource.OTHER)

        # Map confidence string to enum
        confidence_str = raw.get("confidence", "medium")
        confidence = CONFIDENCE_MAP.get(confidence_str, Confidence.MEDIUM)

        # Build bounding box in the model's format: list of {x1, y1, x2, y2} dicts
        bbox_raw = raw.get("bounding_box", {})
        bounding_boxes = [
            {
                "x1": bbox_raw.get("x1", 0),
                "y1": bbox_raw.get("y1", 0),
                "x2": bbox_raw.get("x2", 0),
                "y2": bbox_raw.get("y2", 0),
            }
        ]

        return Evidence(
            evidence_id=evidence_id,
            source=source,
            date_collected=raw.get("date_collected") or "unknown",
            district=raw.get("district"),
            village=raw.get("village"),
            logframe_indicator=raw.get("logframe_indicator"),
            verification_status=VerificationStatus.PENDING,
            summary=raw.get("interpreted_claim", ""),
            raw_text=raw.get("raw_text"),
            confidence=confidence,
            source_file=source_file_path,
            bounding_boxes=bounding_boxes,
        )


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _detect_media_type(image_bytes: bytes) -> str:
    """Detect image media type from magic bytes.

    Args:
        image_bytes: Raw image data.

    Returns:
        MIME type string.

    Raises:
        ValueError: if the format cannot be detected.
    """
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:2] == b"\xff\xd8":
        return "image/jpeg"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    if image_bytes[:4] in (b"GIF8",):
        return "image/gif"
    raise ValueError(
        "Cannot detect image format from magic bytes. "
        "Provide a file path with an extension, or use a supported format "
        "(JPEG, PNG, WebP, GIF)."
    )
