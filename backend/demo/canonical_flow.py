"""Canonical demo flow — the deterministic demo for Poneglyph.

Runs the full 5-agent pipeline on fixed synthetic inputs:
  3 scanned forms (English, Hindi, cold storage inspection)
  2 meeting transcripts (kickoff review, Q1 progress review)
  1 canonical query ("Where are we on the women's PHM training target?")
  1 report section ("Progress on Women's PHM Training", World Bank format)

This is what the video shows. Every run starts from a reset project
and uses the same inputs, so the structure is consistent even though
the LLM outputs vary slightly between runs.
"""

from __future__ import annotations

from typing import Any

from demo.demo_project import (
    DEMO_DONOR_FORMAT,
    DEMO_IMAGE_PATHS,
    DEMO_PROJECT_ID,
    DEMO_QUERY,
    DEMO_SECTION_NAME,
    DEMO_TRANSCRIPT_PATHS,
    reset_demo_project,
)
from memory.project_memory import ProjectMemory
from orchestrator import Orchestrator, ProgressCallback


def run_canonical_demo(
    memory: ProjectMemory,
    on_progress: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Reset the demo project and run the full agent pipeline.

    This is the one-button demo flow:
    1. Wipe and re-seed the demo project
    2. Run Orchestrator.run_full_demo() with fixed inputs

    Args:
        memory: The shared ProjectMemory instance.
        on_progress: Optional callback for SSE progress events.

    Returns:
        The full results dict from Orchestrator.run_full_demo().
    """
    # Step 1: Reset to clean state
    project_id = reset_demo_project(memory)

    # Step 2: Run the pipeline on fixed inputs
    orch = Orchestrator(memory=memory, on_progress=on_progress)
    return orch.run_full_demo(
        project_id=project_id,
        image_paths=DEMO_IMAGE_PATHS,
        transcript_paths=DEMO_TRANSCRIPT_PATHS,
        query=DEMO_QUERY,
        section_name=DEMO_SECTION_NAME,
        donor_format=DEMO_DONOR_FORMAT,
    )
