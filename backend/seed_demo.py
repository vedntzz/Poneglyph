"""Seed the mp-fpc-2024 demo project with a logframe.

Run once before starting the backend for demo mode:
    cd backend && uv run python seed_demo.py

Creates the project directory structure and loads the logframe that
Scout, Scribe, Archivist, Drafter, and Auditor all reference during
the canonical demo flow (CLAUDE.md § demo flow).

Idempotent — safe to run multiple times.
"""

from __future__ import annotations

from memory.project_memory import ProjectMemory

PROJECT_ID = "mp-fpc-2024"
PROJECT_NAME = "Madhya Pradesh Farmer Producer Company Project"
DONOR = "World Bank"

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


def main() -> None:
    """Create or update the demo project."""
    memory = ProjectMemory()

    project_dir = memory.create_project(PROJECT_ID, PROJECT_NAME, DONOR)
    print(f"Project directory: {project_dir}")

    logframe_path = memory.load_logframe(PROJECT_ID, LOGFRAME)
    print(f"Logframe loaded: {logframe_path}")

    print(f"\nDemo project '{PROJECT_ID}' is ready.")


if __name__ == "__main__":
    main()
