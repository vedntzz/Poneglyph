"""Poneglyph project memory — file-system-based project binder.

This package implements the core data layer for Poneglyph's institutional
memory. Each project is a directory of human-readable markdown files with
YAML frontmatter — no database, no vector store. This design showcases
Opus 4.7's file-system-based persistent memory capability.

See ARCHITECTURE.md#archivist-design and CAPABILITIES.md#file-memory.
"""

from memory.models import (
    Commitment,
    Evidence,
    Meeting,
    StakeholderPosition,
    TimelineEvent,
)
from memory.project_memory import ProjectMemory

__all__ = [
    "Commitment",
    "Evidence",
    "Meeting",
    "ProjectMemory",
    "StakeholderPosition",
    "TimelineEvent",
]
