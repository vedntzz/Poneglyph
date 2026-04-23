"""Minimal Scout test — tiny image, minimal tokens, just checks the pipeline works.

Run: cd backend && uv run python agents/test_scout_minimal.py
"""

from __future__ import annotations

import io
import shutil
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from agents.scout import ScoutAgent
from memory.project_memory import ProjectMemory


def make_tiny_image() -> bytes:
    """Create a 200x100 image with '47 farmers' on it."""
    img = Image.new("RGB", (200, 100), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 40), "47 farmers registered", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def run() -> None:
    tmp = Path(tempfile.mkdtemp(prefix="scout_min_"))
    try:
        mem = ProjectMemory(data_dir=tmp)
        mem.create_project("t", "Test", "WB")
        mem.load_logframe("t", "Output 1.2: Farmers enrolled")

        scout = ScoutAgent(memory=mem)
        result = scout.run(
            project_id="t",
            image_source=make_tiny_image(),
            logframe="Output 1.2: Farmers enrolled",
        )

        print(f"Evidence items: {len(result)}")
        for ev in result:
            print(f"  {ev.evidence_id}: {ev.summary[:60]}")
            print(f"  boxes: {ev.bounding_boxes}")
            print(f"  confidence: {ev.confidence}")

        stored = mem.read_all_evidence("t")
        assert len(stored) == len(result), f"Memory has {len(stored)}, expected {len(result)}"
        print(f"\nPersistence OK: {len(stored)} items in memory")
        print("PASS")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    run()
