"""Poneglyph backend — FastAPI service for the multi-agent system.

Session 001: single endpoint (POST /api/hello-agent) that sends a user
message to Opus 4.7 and returns the response. This validates the full
stack round-trip before any real agent logic is added.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
from pathlib import Path
from typing import Any

import anthropic
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from agents.archivist import ArchivistAgent, AnswerWithCitations, Citation, Contradiction
from agents.auditor import AuditorAgent, VerificationTag, VerifiedClaim, VerifiedSection
from agents.drafter import DrafterAgent, Claim, DraftSection
from agents.scribe import ScribeAgent, MeetingRecord, ExtractedCommitment, Disagreement
from agents.scout import ScoutAgent
from memory.project_memory import ProjectMemory
from orchestrator import AgentStatus, Orchestrator, ProgressEvent

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Poneglyph",
    description="Multi-agent institutional memory for development projects",
    version="0.1.0",
)

# CORS: allow the Next.js frontend in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────────────────────

class HelloAgentRequest(BaseModel):
    """User message to send to Opus 4.7."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="The user's message to send to the agent.",
    )


class HelloAgentResponse(BaseModel):
    """Response from Opus 4.7."""

    reply: str = Field(description="The model's text response.")
    model: str = Field(description="The model ID that generated the response.")
    usage: dict[str, Any] = Field(description="Token usage for this request.")


# ─────────────────────────────────────────────────────────────
# Anthropic client
# ─────────────────────────────────────────────────────────────

def get_anthropic_client() -> anthropic.Anthropic:
    """Create an Anthropic client using the ANTHROPIC_API_KEY env var.

    Raises:
        ValueError: if the API key is not set.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY environment variable is not set. "
            "Set it in your shell or in a .env file."
        )
    return anthropic.Anthropic(api_key=api_key)


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check() -> dict[str, str]:
    """Simple health check for the backend."""
    return {"status": "ok"}


@app.post("/api/hello-agent", response_model=HelloAgentResponse)
def hello_agent(request: HelloAgentRequest) -> HelloAgentResponse:
    """Send a message to Opus 4.7 and return the response.

    Uses adaptive thinking and high effort. Does NOT set temperature,
    top_p, or top_k — they return 400 on Opus 4.7.
    See CLAUDE.md § Model parameters.

    Args:
        request: The user's message wrapped in a HelloAgentRequest.

    Returns:
        HelloAgentResponse with the model's reply and usage stats.

    Raises:
        HTTPException: on Anthropic API errors.
    """
    try:
        client = get_anthropic_client()

        # Opus 4.7 call with adaptive thinking — see CAPABILITIES.md
        # No temperature/top_p/top_k: they return 400 on 4.7
        # effort: "high" for simple extraction — see CLAUDE.md § Model parameters
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            messages=[
                {"role": "user", "content": request.message},
            ],
        )

        # Extract text from response content blocks
        reply_text = ""
        for block in response.content:
            if block.type == "text":
                reply_text += block.text

        return HelloAgentResponse(
            reply=reply_text,
            model=response.model,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )

    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Anthropic API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ─────────────────────────────────────────────────────────────
# Scout endpoint
# ─────────────────────────────────────────────────────────────

class BoundingBox(BaseModel):
    """Pixel-coordinate bounding box from Opus 4.7's vision."""

    x1: int
    y1: int
    x2: int
    y2: int


class EvidenceResponse(BaseModel):
    """A single evidence item extracted by Scout."""

    evidence_id: str
    source: str
    date_collected: str
    district: str | None = None
    village: str | None = None
    logframe_indicator: str | None = None
    summary: str
    raw_text: str | None = None
    confidence: str | None = None
    source_file: str | None = None
    bounding_boxes: list[BoundingBox] | None = None


class ScoutExtractResponse(BaseModel):
    """Response from the Scout evidence extraction endpoint."""

    project_id: str
    evidence_count: int
    evidence: list[EvidenceResponse]


# Shared ProjectMemory instance — see CLAUDE.md § Agent architecture.
# HACKATHON COMPROMISE: single instance, no project isolation beyond
# the project_id directory. See FAILURE_MODES.md.
_memory = ProjectMemory()


@app.post("/api/scout/extract", response_model=ScoutExtractResponse)
async def scout_extract(
    project_id: str = Form(..., description="Project slug, e.g. 'mp-fpc-2024'."),
    image: UploadFile = File(..., description="Document image to extract evidence from."),
) -> ScoutExtractResponse:
    """Extract evidence from a document image using the Scout agent.

    Accepts a project_id and an image upload, runs Scout with Opus 4.7's
    pixel-coordinate vision, and returns structured evidence with bounding
    boxes. Evidence is also persisted to ProjectMemory.

    The project must already exist and have a logframe loaded.
    """
    # Read the project's logframe — Scout needs it to map evidence to indicators
    project_dir = _memory._project_dir(project_id)
    logframe_path = project_dir / "logframe.md"

    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_id}' not found. Create it first via the API.",
        )
    if not logframe_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Project '{project_id}' has no logframe. Load one before running Scout.",
        )

    # Read logframe body (skip YAML frontmatter)
    logframe_text = logframe_path.read_text(encoding="utf-8")
    # Strip frontmatter if present
    if logframe_text.startswith("---\n"):
        parts = logframe_text.split("---\n", maxsplit=2)
        if len(parts) >= 3:
            logframe_text = parts[2].strip()

    # Read uploaded image
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    # Store the uploaded image so it can be referenced later
    uploads_dir = project_dir / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    stored_path = uploads_dir / (image.filename or "upload.png")
    stored_path.write_bytes(image_bytes)

    try:
        scout = ScoutAgent(memory=_memory)
        evidence_list = scout.run(
            project_id=project_id,
            image_source=image_bytes,
            logframe=logframe_text,
            source_file_path=str(stored_path),
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Scout API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # Convert Evidence models to response format
    response_evidence = []
    for ev in evidence_list:
        boxes = None
        if ev.bounding_boxes:
            boxes = [BoundingBox(**box) for box in ev.bounding_boxes]
        response_evidence.append(
            EvidenceResponse(
                evidence_id=ev.evidence_id,
                source=ev.source.value,
                date_collected=ev.date_collected,
                district=ev.district,
                village=ev.village,
                logframe_indicator=ev.logframe_indicator,
                summary=ev.summary,
                raw_text=ev.raw_text,
                confidence=ev.confidence.value if ev.confidence else None,
                source_file=ev.source_file,
                bounding_boxes=boxes,
            )
        )

    return ScoutExtractResponse(
        project_id=project_id,
        evidence_count=len(response_evidence),
        evidence=response_evidence,
    )


# ─────────────────────────────────────────────────────────────
# Scribe endpoint
# ─────────────────────────────────────────────────────────────

class ScribeProcessRequest(BaseModel):
    """Request body for the Scribe meeting processing endpoint."""

    project_id: str = Field(
        ...,
        min_length=1,
        description="Project slug, e.g. 'mp-fpc-2024'.",
    )
    transcript: str = Field(
        ...,
        min_length=1,
        description="Full text of the meeting transcript.",
    )


class CommitmentResponse(BaseModel):
    """A commitment extracted from the meeting."""

    owner: str
    description: str
    due_date: str | None = None
    logframe_indicator: str | None = None


class DisagreementResponse(BaseModel):
    """A disagreement detected in the meeting."""

    parties: list[str]
    topic: str
    resolution: str | None = None


class ScribeProcessResponse(BaseModel):
    """Response from the Scribe meeting processing endpoint."""

    project_id: str
    date: str
    attendees: list[str]
    decisions: list[str]
    commitments: list[CommitmentResponse]
    open_questions: list[str]
    disagreements: list[DisagreementResponse]
    full_mom_markdown: str
    notes: str | None = None


@app.post("/api/scribe/process", response_model=ScribeProcessResponse)
def scribe_process(request: ScribeProcessRequest) -> ScribeProcessResponse:
    """Process a meeting transcript using the Scribe agent.

    Extracts decisions, commitments, open questions, and disagreements.
    Persists the meeting record and commitments to ProjectMemory.
    """
    project_dir = _memory._project_dir(request.project_id)
    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project '{request.project_id}' not found. Create it first.",
        )

    try:
        scribe = ScribeAgent(memory=_memory)
        record = scribe.run(
            project_id=request.project_id,
            transcript=request.transcript,
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Scribe API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return ScribeProcessResponse(
        project_id=request.project_id,
        date=record.date,
        attendees=record.attendees,
        decisions=record.decisions,
        commitments=[
            CommitmentResponse(
                owner=c.owner,
                description=c.description,
                due_date=c.due_date,
                logframe_indicator=c.logframe_indicator,
            )
            for c in record.commitments
        ],
        open_questions=record.open_questions,
        disagreements=[
            DisagreementResponse(
                parties=d.parties,
                topic=d.topic,
                resolution=d.resolution,
            )
            for d in record.disagreements
        ],
        full_mom_markdown=record.full_mom_markdown,
        notes=record.notes,
    )


# ─────────────────────────────────────────────────────────────
# Archivist endpoints
# ─────────────────────────────────────────────────────────────

class ArchivistQueryRequest(BaseModel):
    """Request body for the Archivist query endpoint."""

    project_id: str = Field(
        ...,
        min_length=1,
        description="Project slug.",
    )
    query: str = Field(
        ...,
        min_length=1,
        description="Question about the project.",
    )


class CitationResponse(BaseModel):
    """A citation to a file in the project binder."""

    file_path: str
    excerpt: str


class ArchivistQueryResponse(BaseModel):
    """Response from the Archivist query endpoint."""

    project_id: str
    query: str
    answer: str
    citations: list[CitationResponse]
    gaps: list[str]


@app.post("/api/archivist/query", response_model=ArchivistQueryResponse)
def archivist_query(request: ArchivistQueryRequest) -> ArchivistQueryResponse:
    """Ask a question about the project. Archivist reads memory files on demand.

    Uses Opus 4.7's file-system-based persistent memory — the Archivist
    reads specific files from the project binder using tool use, like a
    consultant re-opening their notes. See CAPABILITIES.md#file-memory.
    """
    project_dir = _memory._project_dir(request.project_id)
    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project '{request.project_id}' not found.",
        )

    try:
        archivist = ArchivistAgent(memory=_memory)
        result = archivist.answer_query(
            project_id=request.project_id,
            query=request.query,
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Archivist API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return ArchivistQueryResponse(
        project_id=request.project_id,
        query=request.query,
        answer=result.answer,
        citations=[
            CitationResponse(file_path=c.file_path, excerpt=c.excerpt)
            for c in result.citations
        ],
        gaps=result.gaps,
    )


class ContradictionResponse(BaseModel):
    """A contradiction detected in the project records."""

    description: str
    earlier_source: str
    later_source: str
    earlier_claim: str
    later_claim: str
    severity: str


class ArchivistContradictionsResponse(BaseModel):
    """Response from the Archivist contradiction detection endpoint."""

    project_id: str
    contradiction_count: int
    contradictions: list[ContradictionResponse]


class ArchivistContradictionsRequest(BaseModel):
    """Request body for the Archivist contradiction detection endpoint."""

    project_id: str = Field(
        ...,
        min_length=1,
        description="Project slug.",
    )


@app.post("/api/archivist/contradictions", response_model=ArchivistContradictionsResponse)
def archivist_contradictions(
    request: ArchivistContradictionsRequest,
) -> ArchivistContradictionsResponse:
    """Detect contradictions across the project's commitments and meetings.

    Uses Opus 4.7 with deep reasoning to identify cases where later
    meetings implicitly walk back earlier commitments.
    See CAPABILITIES.md#adaptive-thinking.
    """
    project_dir = _memory._project_dir(request.project_id)
    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project '{request.project_id}' not found.",
        )

    try:
        archivist = ArchivistAgent(memory=_memory)
        contradictions = archivist.detect_contradictions(
            project_id=request.project_id,
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Archivist API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return ArchivistContradictionsResponse(
        project_id=request.project_id,
        contradiction_count=len(contradictions),
        contradictions=[
            ContradictionResponse(
                description=c.description,
                earlier_source=c.earlier_source,
                later_source=c.later_source,
                earlier_claim=c.earlier_claim,
                later_claim=c.later_claim,
                severity=c.severity,
            )
            for c in contradictions
        ],
    )


# ─────────────────────────────────────────────────────────────
# Drafter endpoint
# ─────────────────────────────────────────────────────────────

class DrafterRequest(BaseModel):
    """Request body for the Drafter report-writing endpoint."""

    project_id: str = Field(..., min_length=1, description="Project slug.")
    section_name: str = Field(
        ...,
        min_length=1,
        description="Section title, e.g. 'Progress on Women's Training'.",
    )
    donor_format: str = Field(
        default="world_bank",
        description="Donor format slug: 'world_bank', 'giz', or 'nabard'.",
    )


class ClaimResponse(BaseModel):
    """A single factual claim with source attribution."""

    text: str
    citation_ids: list[str]
    source_type: str


class DraftSectionResponse(BaseModel):
    """Response from the Drafter endpoint."""

    project_id: str
    section_name: str
    donor_format: str
    claims: list[ClaimResponse]
    rendered_markdown: str
    gaps: list[str]


@app.post("/api/drafter/draft", response_model=DraftSectionResponse)
def drafter_draft(request: DrafterRequest) -> DraftSectionResponse:
    """Draft a donor-format report section using the Drafter agent.

    Reads evidence, meetings, and commitments from the project binder,
    then writes a report section with every claim traced to a source.
    Uses Opus 4.7's adaptive thinking for cross-document synthesis.
    See CAPABILITIES.md#adaptive-thinking.
    """
    project_dir = _memory._project_dir(request.project_id)
    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project '{request.project_id}' not found.",
        )

    try:
        drafter = DrafterAgent(memory=_memory)
        draft = drafter.run(
            project_id=request.project_id,
            section_name=request.section_name,
            donor_format=request.donor_format,
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Drafter API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return DraftSectionResponse(
        project_id=request.project_id,
        section_name=draft.section_name,
        donor_format=draft.donor_format,
        claims=[
            ClaimResponse(
                text=c.text,
                citation_ids=c.citation_ids,
                source_type=c.source_type,
            )
            for c in draft.claims
        ],
        rendered_markdown=draft.rendered_markdown,
        gaps=draft.gaps,
    )


# ─────────────────────────────────────────────────────────────
# Auditor endpoint
# ─────────────────────────────────────────────────────────────

class AuditorRequest(BaseModel):
    """Request body for the Auditor verification endpoint."""

    project_id: str = Field(..., min_length=1, description="Project slug.")
    draft_section: DraftSectionResponse = Field(
        ...,
        description="The DraftSectionResponse output from the Drafter endpoint.",
    )


class VerifiedClaimResponse(BaseModel):
    """A claim after Auditor verification."""

    text: str
    citation_ids: list[str]
    source_type: str
    tag: str
    reason: str
    used_vision: bool


class VerifiedSectionResponse(BaseModel):
    """Response from the Auditor endpoint."""

    project_id: str
    section_name: str
    donor_format: str
    verified_claims: list[VerifiedClaimResponse]
    rendered_markdown: str
    summary: str


@app.post("/api/auditor/verify", response_model=VerifiedSectionResponse)
def auditor_verify(request: AuditorRequest) -> VerifiedSectionResponse:
    """Verify a draft report section using the Auditor agent.

    Re-reads every cited source independently and tags each claim as
    VERIFIED (✓), CONTESTED (⚠), or UNSUPPORTED (✗). For image evidence
    with MEDIUM/LOW confidence, makes independent Opus 4.7 vision calls.
    See CAPABILITIES.md#self-verification.
    """
    project_dir = _memory._project_dir(request.project_id)
    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project '{request.project_id}' not found.",
        )

    # Reconstruct DraftSection from the request
    draft = DraftSection(
        section_name=request.draft_section.section_name,
        donor_format=request.draft_section.donor_format,
        claims=[
            Claim(
                text=c.text,
                citation_ids=c.citation_ids,
                source_type=c.source_type,
            )
            for c in request.draft_section.claims
        ],
        rendered_markdown=request.draft_section.rendered_markdown,
        gaps=request.draft_section.gaps,
    )

    try:
        auditor = AuditorAgent(memory=_memory)
        verified = auditor.verify(
            project_id=request.project_id,
            draft=draft,
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Auditor API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return VerifiedSectionResponse(
        project_id=request.project_id,
        section_name=verified.section_name,
        donor_format=verified.donor_format,
        verified_claims=[
            VerifiedClaimResponse(
                text=vc.text,
                citation_ids=vc.citation_ids,
                source_type=vc.source_type,
                tag=vc.tag.value,
                reason=vc.reason,
                used_vision=vc.used_vision,
            )
            for vc in verified.verified_claims
        ],
        rendered_markdown=verified.rendered_markdown,
        summary=verified.summary,
    )


# ─────────────────────────────────────────────────────────────
# Combined report endpoint — drafts then audits in one call
# ─────────────────────────────────────────────────────────────

@app.post("/api/report/generate", response_model=VerifiedSectionResponse)
def report_generate(request: DrafterRequest) -> VerifiedSectionResponse:
    """Draft and verify a report section in one call.

    Runs the full Drafter → Auditor pipeline: writes the section in donor
    format, then adversarially verifies every claim. This is the primary
    endpoint for the demo flow (CLAUDE.md § demo flow steps 8-9).
    """
    project_dir = _memory._project_dir(request.project_id)
    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project '{request.project_id}' not found.",
        )

    try:
        # Phase 1: Drafter writes the section
        drafter = DrafterAgent(memory=_memory)
        draft = drafter.run(
            project_id=request.project_id,
            section_name=request.section_name,
            donor_format=request.donor_format,
        )

        # Phase 2: Auditor verifies every claim
        auditor = AuditorAgent(memory=_memory)
        verified = auditor.verify(
            project_id=request.project_id,
            draft=draft,
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Report generation API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return VerifiedSectionResponse(
        project_id=request.project_id,
        section_name=verified.section_name,
        donor_format=verified.donor_format,
        verified_claims=[
            VerifiedClaimResponse(
                text=vc.text,
                citation_ids=vc.citation_ids,
                source_type=vc.source_type,
                tag=vc.tag.value,
                reason=vc.reason,
                used_vision=vc.used_vision,
            )
            for vc in verified.verified_claims
        ],
        rendered_markdown=verified.rendered_markdown,
        summary=verified.summary,
    )


# ─────────────────────────────────────────────────────────────
# Orchestrator SSE streaming endpoint
# ─────────────────────────────────────────────────────────────

# Supported SSE actions — maps to Orchestrator methods
SSE_ACTIONS = {"ingest", "query", "report", "full_demo"}

# Default demo data paths — relative to repo root
_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_IMAGES = [
    str(_REPO_ROOT / "data" / "synthetic" / "form_english.png"),
    str(_REPO_ROOT / "data" / "synthetic" / "form_hindi.png"),
]
_DEFAULT_TRANSCRIPTS = [
    str(_REPO_ROOT / "data" / "synthetic" / "meetings" / "meeting_001.txt"),
    str(_REPO_ROOT / "data" / "synthetic" / "meetings" / "meeting_002.txt"),
]


@app.get("/api/orchestrator/stream")
def orchestrator_stream(
    project_id: str = Query(..., description="Project slug."),
    action: str = Query("full_demo", description="Action: ingest, query, report, full_demo."),
) -> StreamingResponse:
    """Stream orchestrator progress events via Server-Sent Events.

    Runs the orchestrator in a background thread and yields progress
    events as SSE data frames. The frontend connects with EventSource
    and updates agent cards in real time.

    Uses Opus 4.7 task budgets (beta header task-budgets-2026-03-13)
    to give each agent a visible token countdown. This is the feature
    nobody has shipped yet. See CAPABILITIES.md#task-budgets.
    """
    if action not in SSE_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action '{action}'. Must be one of: {SSE_ACTIONS}",
        )

    project_dir = _memory._project_dir(project_id)
    if not project_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_id}' not found.",
        )

    # Thread-safe queue: orchestrator pushes events, SSE generator pulls them
    event_queue: queue.Queue[ProgressEvent | None] = queue.Queue()

    def on_progress(event: ProgressEvent) -> None:
        """Callback: push event into the queue for SSE consumption."""
        event_queue.put(event)

    def run_orchestrator() -> None:
        """Run the orchestrator in a background thread."""
        try:
            orch = Orchestrator(memory=_memory, on_progress=on_progress)

            if action == "ingest":
                orch.run_ingestion(
                    project_id=project_id,
                    image_paths=_DEFAULT_IMAGES,
                    transcript_paths=_DEFAULT_TRANSCRIPTS,
                )
            elif action == "query":
                orch.run_query(
                    project_id=project_id,
                    query="Where are we on the women's PHM training target?",
                )
            elif action == "report":
                orch.run_report_section(
                    project_id=project_id,
                    section_name="Progress on Women's PHM Training",
                    donor_format="world_bank",
                )
            elif action == "full_demo":
                orch.run_full_demo(
                    project_id=project_id,
                    image_paths=_DEFAULT_IMAGES,
                    transcript_paths=_DEFAULT_TRANSCRIPTS,
                )
        except Exception as e:
            logger.error("Orchestrator thread failed: %s", e)
            event_queue.put(ProgressEvent(
                agent_name="orchestrator",
                status=AgentStatus.ERROR,
                current_action=f"Pipeline failed: {str(e)[:200]}",
            ))
        finally:
            # Sentinel: None signals the generator to stop
            event_queue.put(None)

    def event_generator():
        """Yield SSE-formatted events from the queue."""
        # Start the orchestrator in a background thread
        thread = threading.Thread(target=run_orchestrator, daemon=True)
        thread.start()

        while True:
            # Block until an event arrives (timeout prevents hanging forever)
            try:
                event = event_queue.get(timeout=120)
            except queue.Empty:
                # Send a keepalive comment to prevent connection timeout
                yield ": keepalive\n\n"
                continue

            if event is None:
                # Sentinel — orchestrator is done
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                break

            payload = event.to_dict()
            payload["type"] = "progress"
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
