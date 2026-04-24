"""Demo project setup and reset.

Creates or resets the mp-fpc-2024 demo project with its logframe.
Subsumes the original seed_demo.py — this is the canonical way to
prepare the demo project for a run.

The logframe matches CLAUDE.md § demo flow: 3 outputs, 8 indicators.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from memory.project_memory import ProjectMemory

DEMO_PROJECT_ID = "mp-fpc-2024"
DEMO_PROJECT_NAME = "Madhya Pradesh Farmer Producer Company Project"
DEMO_DONOR = "World Bank"

# Repo root — for locating synthetic data files
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Fixed synthetic inputs for the canonical demo flow.
# 3 scanned forms + 2 meeting transcripts — matches CLAUDE.md § demo flow.
DEMO_IMAGE_PATHS = [
    str(_REPO_ROOT / "data" / "synthetic" / "form_english.png"),
    str(_REPO_ROOT / "data" / "synthetic" / "form_hindi.png"),
    str(_REPO_ROOT / "data" / "synthetic" / "form_cold_storage.png"),
]

DEMO_TRANSCRIPT_PATHS = [
    str(_REPO_ROOT / "data" / "synthetic" / "meetings" / "meeting_001.txt"),
    str(_REPO_ROOT / "data" / "synthetic" / "meetings" / "meeting_002.txt"),
]

# The canonical demo query and report section
DEMO_QUERY = "Where are we on the women's PHM training target?"
DEMO_SECTION_NAME = "Progress on Women's PHM Training"
DEMO_DONOR_FORMAT = "world_bank"

LOGFRAME = """## Output 1: Farmer Producer Companies Established

| Indicator | Target | Unit |
|-----------|--------|------|
| 1.1 FPCs registered | 15 | FPCs |
| 1.2 Farmers enrolled | 10,000 | farmers |
| 1.3 Women farmer participation | 30% | percentage |

## Output 2: Infrastructure Development

| Indicator | Target | Unit |
|-----------|--------|------|
| 2.1 Cold storage facilities | 5 | facilities |
| 2.2 Sale points operational | 20 | sale points |

## Output 3: Capacity Building

| Indicator | Target | Unit |
|-----------|--------|------|
| 3.1 PHM trainings conducted | 50 | trainings |
| 3.2 Women's PHM trainings | 20 | trainings |
| 3.3 Stakeholders trained | 1,000 | people |
"""


def setup_demo_project(memory: ProjectMemory) -> str:
    """Create the demo project with its logframe. Idempotent.

    Args:
        memory: The ProjectMemory instance to use.

    Returns:
        The project_id ("mp-fpc-2024").
    """
    memory.create_project(DEMO_PROJECT_ID, DEMO_PROJECT_NAME, DEMO_DONOR)
    memory.load_logframe(DEMO_PROJECT_ID, LOGFRAME)
    return DEMO_PROJECT_ID


def reset_demo_project(memory: ProjectMemory) -> str:
    """Wipe the demo project directory and re-create it fresh.

    This ensures every demo run starts from a clean state — no leftover
    evidence, meetings, or commitments from prior runs.

    Args:
        memory: The ProjectMemory instance to use.

    Returns:
        The project_id ("mp-fpc-2024").
    """
    project_dir = memory._project_dir(DEMO_PROJECT_ID)
    if project_dir.exists():
        shutil.rmtree(project_dir)

    return setup_demo_project(memory)
