"""ProjectMemory — file-system-based project binder.

This is the core data layer for Poneglyph. Each project is a directory of
human-readable markdown files with YAML frontmatter. The Archivist agent
reads and writes these files using Opus 4.7's file-system-based persistent
memory — the "consultant opens their binder" behavior.

Design rationale (see ARCHITECTURE.md#archivist-design):
- Flat markdown files, not a database, because the point is to showcase
  Opus 4.7's ability to maintain structured memory on the file system.
- YAML frontmatter for structured fields that agents can parse reliably.
- Markdown body for free-form prose that agents write naturally.
- Human-readable and git-friendly — a PM could open these files directly.

HACKATHON COMPROMISE: single-project support only. Real product would
need project_id scoping on every memory operation. See FAILURE_MODES.md.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import yaml

from memory.models import (
    Commitment,
    CommitmentStatus,
    Evidence,
    EvidenceSource,
    Meeting,
    StakeholderPosition,
    TimelineEvent,
    TimelineEventType,
    VerificationStatus,
)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

# Default base directory for project data. Overridable in constructor
# so tests can use a temp directory.
DEFAULT_DATA_DIR = Path("data/projects")

# Subdirectories within each project binder
SUBDIRS = ("evidence", "meetings", "commitments", "stakeholders")


# ─────────────────────────────────────────────────────────────
# Frontmatter helpers
# ─────────────────────────────────────────────────────────────

def _write_markdown(path: Path, frontmatter: dict[str, object], body: str) -> None:
    """Write a markdown file with YAML frontmatter.

    Args:
        path: Destination file path.
        frontmatter: Dict to serialize as YAML between --- fences.
        body: Markdown content after the frontmatter.
    """
    with open(path, "w", encoding="utf-8") as f:
        f.write("---\n")
        yaml.dump(
            frontmatter,
            f,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
        )
        f.write("---\n\n")
        f.write(body)
        if not body.endswith("\n"):
            f.write("\n")


def _read_markdown(path: Path) -> tuple[dict[str, object], str]:
    """Read a markdown file with YAML frontmatter.

    Args:
        path: Source file path.

    Returns:
        Tuple of (frontmatter dict, body string).

    Raises:
        ValueError: if the file doesn't have valid YAML frontmatter.
    """
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(
            f"File {path} does not start with YAML frontmatter (expected '---'). "
            f"Every memory file must have YAML frontmatter between --- fences."
        )

    # Split on the closing --- fence
    parts = text.split("---\n", maxsplit=2)
    if len(parts) < 3:
        raise ValueError(
            f"File {path} has an opening '---' but no closing '---' fence. "
            f"YAML frontmatter must be enclosed between two '---' lines."
        )

    frontmatter_text = parts[1]
    body = parts[2].strip()

    frontmatter = yaml.safe_load(frontmatter_text)
    if frontmatter is None:
        frontmatter = {}

    return frontmatter, body


def _now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────
# ProjectMemory
# ─────────────────────────────────────────────────────────────

class ProjectMemory:
    """File-system-based project binder.

    Each project is a directory tree of markdown files. This class
    provides typed read/write access to that directory. It does NOT
    make LLM calls — it is pure I/O. The Archivist agent (Session 004)
    will use this class to manage project memory.

    Args:
        data_dir: Root directory for all project data. Defaults to
            data/projects/ relative to the repo root. Override in
            tests to use a temp directory.
    """

    def __init__(self, data_dir: Optional[Path] = None) -> None:
        self.data_dir = data_dir or DEFAULT_DATA_DIR

    def _project_dir(self, project_id: str) -> Path:
        """Return the root directory for a project."""
        return self.data_dir / project_id

    # ─── Project lifecycle ───────────────────────────────────

    def create_project(
        self,
        project_id: str,
        name: str,
        donor: str,
    ) -> Path:
        """Scaffold a new project directory with all subdirectories.

        Creates the directory structure and writes a project.yaml metadata
        file. Idempotent — calling again on an existing project updates
        the metadata but does not destroy existing files.

        Args:
            project_id: Unique slug for the project, e.g. "mp-fpc-2024".
            name: Human-readable project name.
            donor: Funding agency, e.g. "World Bank", "GIZ".

        Returns:
            Path to the created project directory.

        Raises:
            ValueError: if project_id is empty or contains path separators.
        """
        if not project_id or "/" in project_id or "\\" in project_id:
            raise ValueError(
                f"Invalid project_id '{project_id}'. Must be a non-empty slug "
                f"with no path separators (use hyphens, e.g. 'mp-fpc-2024')."
            )

        project_dir = self._project_dir(project_id)
        project_dir.mkdir(parents=True, exist_ok=True)

        for subdir in SUBDIRS:
            (project_dir / subdir).mkdir(exist_ok=True)

        # Write project metadata as YAML (not markdown — this is config, not prose)
        metadata = {
            "project_id": project_id,
            "name": name,
            "donor": donor,
            "created_at": _now_iso(),
            "logframe_path": "logframe.md",
        }
        metadata_path = project_dir / "project.yaml"
        with open(metadata_path, "w", encoding="utf-8") as f:
            yaml.dump(metadata, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

        # Initialize empty timeline
        timeline_path = project_dir / "timeline.md"
        if not timeline_path.exists():
            _write_markdown(
                timeline_path,
                {"title": "Project Timeline", "project_id": project_id},
                "<!-- Append-only event log. Each event is a YAML block below. -->\n",
            )

        # Record the creation event
        self.append_timeline(
            project_id,
            TimelineEvent(
                timestamp=_now_iso(),
                event_type=TimelineEventType.PROJECT_CREATED,
                summary=f"Project '{name}' created (donor: {donor})",
                references=["project.yaml"],
            ),
        )

        return project_dir

    def load_logframe(self, project_id: str, logframe_text: str) -> Path:
        """Write or overwrite the project's logframe.

        The logframe defines the project's targets and indicators — it's
        what every piece of evidence is measured against.

        Args:
            project_id: The project slug.
            logframe_text: The logframe content as markdown text.

        Returns:
            Path to the written logframe.md file.
        """
        project_dir = self._project_dir(project_id)
        logframe_path = project_dir / "logframe.md"

        _write_markdown(
            logframe_path,
            {"title": "Project Logframe", "project_id": project_id},
            logframe_text,
        )

        self.append_timeline(
            project_id,
            TimelineEvent(
                timestamp=_now_iso(),
                event_type=TimelineEventType.LOGFRAME_LOADED,
                summary="Logframe loaded/updated",
                references=["logframe.md"],
            ),
        )

        return logframe_path

    # ─── Evidence ────────────────────────────────────────────

    def add_evidence(self, project_id: str, evidence: Evidence) -> str:
        """Write an evidence file to the project binder.

        Args:
            project_id: The project slug.
            evidence: Structured evidence data. The evidence_id field
                is used as the filename.

        Returns:
            The evidence_id.
        """
        evidence_dir = self._project_dir(project_id) / "evidence"
        evidence_dir.mkdir(exist_ok=True)

        frontmatter = evidence.model_dump(exclude={"summary"}, exclude_none=True)
        # Convert enums to their string values for clean YAML
        if "source" in frontmatter:
            frontmatter["source"] = frontmatter["source"].value if isinstance(frontmatter["source"], EvidenceSource) else frontmatter["source"]
        if "verification_status" in frontmatter:
            frontmatter["verification_status"] = frontmatter["verification_status"].value if isinstance(frontmatter["verification_status"], VerificationStatus) else frontmatter["verification_status"]

        file_path = evidence_dir / f"{evidence.evidence_id}.md"
        _write_markdown(file_path, frontmatter, evidence.summary)

        self.append_timeline(
            project_id,
            TimelineEvent(
                timestamp=_now_iso(),
                event_type=TimelineEventType.EVIDENCE_ADDED,
                summary=evidence.summary,
                references=[f"evidence/{evidence.evidence_id}.md"],
            ),
        )

        return evidence.evidence_id

    def read_all_evidence(self, project_id: str) -> list[Evidence]:
        """Read all evidence files from the project binder.

        Args:
            project_id: The project slug.

        Returns:
            List of Evidence objects, sorted by evidence_id.
        """
        evidence_dir = self._project_dir(project_id) / "evidence"
        if not evidence_dir.exists():
            return []

        results: list[Evidence] = []
        for path in sorted(evidence_dir.glob("*.md")):
            frontmatter, body = _read_markdown(path)
            frontmatter["summary"] = body
            results.append(Evidence(**frontmatter))

        return results

    # ─── Meetings ────────────────────────────────────────────

    def add_meeting(self, project_id: str, meeting: Meeting, body: str = "") -> str:
        """Write a meeting record to the project binder.

        Args:
            project_id: The project slug.
            meeting: Structured meeting data.
            body: Optional free-form meeting notes (markdown).

        Returns:
            The meeting_id.
        """
        meetings_dir = self._project_dir(project_id) / "meetings"
        meetings_dir.mkdir(exist_ok=True)

        frontmatter = meeting.model_dump(exclude_none=True)

        file_path = meetings_dir / f"{meeting.meeting_id}.md"
        _write_markdown(file_path, frontmatter, body or f"Meeting: {meeting.agenda or 'No agenda recorded.'}")

        self.append_timeline(
            project_id,
            TimelineEvent(
                timestamp=_now_iso(),
                event_type=TimelineEventType.MEETING_LOGGED,
                summary=f"Meeting logged: {meeting.agenda or meeting.meeting_id}",
                references=[f"meetings/{meeting.meeting_id}.md"],
            ),
        )

        return meeting.meeting_id

    def read_all_meetings(self, project_id: str) -> list[Meeting]:
        """Read all meeting files from the project binder.

        Args:
            project_id: The project slug.

        Returns:
            List of Meeting objects, sorted by meeting_id.
        """
        meetings_dir = self._project_dir(project_id) / "meetings"
        if not meetings_dir.exists():
            return []

        results: list[Meeting] = []
        for path in sorted(meetings_dir.glob("*.md")):
            frontmatter, _body = _read_markdown(path)
            results.append(Meeting(**frontmatter))

        return results

    # ─── Commitments ─────────────────────────────────────────

    def add_commitment(self, project_id: str, commitment: Commitment, body: str = "") -> str:
        """Write a commitment to the project binder.

        Args:
            project_id: The project slug.
            commitment: Structured commitment data.
            body: Optional free-form notes about the commitment.

        Returns:
            The commitment_id.
        """
        commitments_dir = self._project_dir(project_id) / "commitments"
        commitments_dir.mkdir(exist_ok=True)

        frontmatter = commitment.model_dump(exclude_none=True)
        # Convert enum to string for clean YAML
        if "status" in frontmatter:
            frontmatter["status"] = frontmatter["status"].value if isinstance(frontmatter["status"], CommitmentStatus) else frontmatter["status"]

        file_path = commitments_dir / f"{commitment.commitment_id}.md"
        _write_markdown(
            file_path,
            frontmatter,
            body or commitment.description,
        )

        self.append_timeline(
            project_id,
            TimelineEvent(
                timestamp=_now_iso(),
                event_type=TimelineEventType.COMMITMENT_MADE,
                summary=f"Commitment: {commitment.description}",
                references=[
                    f"commitments/{commitment.commitment_id}.md",
                    f"meetings/{commitment.made_in_meeting}.md",
                ],
            ),
        )

        return commitment.commitment_id

    def read_all_commitments(self, project_id: str) -> list[Commitment]:
        """Read all commitment files from the project binder.

        Args:
            project_id: The project slug.

        Returns:
            List of Commitment objects, sorted by commitment_id.
        """
        commitments_dir = self._project_dir(project_id) / "commitments"
        if not commitments_dir.exists():
            return []

        results: list[Commitment] = []
        for path in sorted(commitments_dir.glob("*.md")):
            frontmatter, _body = _read_markdown(path)
            results.append(Commitment(**frontmatter))

        return results

    # ─── Timeline ────────────────────────────────────────────

    def append_timeline(self, project_id: str, event: TimelineEvent) -> None:
        """Append an event to the project's timeline.

        The timeline is an append-only log. Each event is written as a
        YAML block separated by --- within the markdown body.

        Args:
            project_id: The project slug.
            event: The timeline event to append.
        """
        timeline_path = self._project_dir(project_id) / "timeline.md"

        event_dict = event.model_dump()
        # Convert enum to string for clean YAML
        event_dict["event_type"] = event.event_type.value

        # Append the event as a YAML block
        event_yaml = yaml.dump(
            event_dict,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
        )

        with open(timeline_path, "a", encoding="utf-8") as f:
            f.write(f"\n---\n{event_yaml}")

    def read_timeline(self, project_id: str) -> list[TimelineEvent]:
        """Read all events from the project timeline.

        Args:
            project_id: The project slug.

        Returns:
            List of TimelineEvent objects in chronological order.
        """
        timeline_path = self._project_dir(project_id) / "timeline.md"
        if not timeline_path.exists():
            return []

        text = timeline_path.read_text(encoding="utf-8")

        # The file starts with frontmatter (--- block ---), then events
        # are appended as --- separated YAML blocks.
        # Split on --- and parse each block that looks like a timeline event.
        blocks = text.split("\n---\n")

        results: list[TimelineEvent] = []
        for block in blocks:
            block = block.strip()
            if not block:
                continue

            parsed = yaml.safe_load(block)
            if not isinstance(parsed, dict):
                continue

            # Timeline events have 'timestamp' and 'event_type' fields
            if "timestamp" in parsed and "event_type" in parsed:
                results.append(TimelineEvent(**parsed))

        return results

    # ─── Contradiction detection (stub) ──────────────────────

    def find_contradictions(self, project_id: str) -> list[dict[str, object]]:
        """Detect contradictions across project evidence and commitments.

        STUB: returns an empty list. Real implementation in Session 004
        will use the Archivist agent with Opus 4.7 to reason across the
        full project binder and flag conflicting information.

        Args:
            project_id: The project slug.

        Returns:
            Empty list (stub). Future: list of contradiction dicts with
            'description', 'sources', and 'severity' fields.
        """
        # HACKATHON COMPROMISE: contradiction detection requires LLM reasoning
        # across the full project binder. Stubbed until Session 004 (Archivist).
        # See FAILURE_MODES.md.
        _ = project_id  # acknowledge the parameter
        return []
