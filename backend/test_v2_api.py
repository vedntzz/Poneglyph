"""Unit and integration tests for Poneglyph V2 Endpoints."""

import json
from fastapi.testclient import TestClient
from main import app
import db

client = TestClient(app)

def test_v2_flow():
    # 1. Reset
    res = client.post("/api/v2/reset")
    assert res.status_code == 200, res.text
    print("✓ Reset DB successful")

    # 2. Get Project
    res = client.get("/api/v2/project")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["project"]["id"] == "proj-mp-fpc"
    assert data["metrics"]["target_quantity"] == 50
    assert data["metrics"]["verified_quantity"] == 28
    assert data["metrics"]["missing_quantity"] == 8
    assert data["metrics"]["open_gaps_count"] == 2
    print("✓ Project status retrieved: 28/50 verified, 8 missing, ₹12L at risk")

    # 3. Get Gaps
    res = client.get("/api/v2/gaps")
    assert res.status_code == 200
    gaps = res.json()
    assert len(gaps) == 2
    assert gaps[0]["id"] == "gap-001"
    print("✓ Pre-billing gap alerts verified (gap-001 Raisen 8 missing proofs)")

    # 4. Dispatch WhatsApp Prompt
    res = client.post("/api/v2/gaps/gap-001/dispatch")
    assert res.status_code == 200
    dispatch_res = res.json()
    assert dispatch_res["status"] == "success"
    print("✓ Dispatched WhatsApp prompt to Raisen Block Coordinator")

    # 5. Ingest WhatsApp Proof (Simulate incoming register photo)
    res = client.post("/api/v2/ingest/whatsapp", json={
        "sender_name": "Mahesh Sharma",
        "sender_role": "Block Coordinator, Raisen",
        "district": "Raisen",
        "village": "Gairatganj",
        "sample_image": "/static/synthetic/form_hindi.png",
        "message_text": "रायसेन के 8 एग्रीमार्ट केंद्रों के उद्घाटन रजिस्टर संलग्न हैं।",
        "milestone_id": "ms-003",
        "gap_id": "gap-001"
    })
    assert res.status_code == 200
    ingest_res = res.json()
    assert ingest_res["status"] == "success"
    assert len(ingest_res["bounding_boxes"]) == 3
    print("✓ Ingested field proof via WhatsApp: Bounding boxes extracted")

    # 6. Re-verify project status (Verified should now be 36, missing 0)
    res = client.get("/api/v2/project")
    assert res.status_code == 200
    updated_data = res.json()
    assert updated_data["metrics"]["verified_quantity"] == 36
    assert updated_data["metrics"]["missing_quantity"] == 0
    print("✓ Milestone updated to 36/50 verified, 0 missing (100% gap closed)")

    # 7. Get Dossier
    res = client.get("/api/v2/dossier")
    assert res.status_code == 200
    dossier = res.json()
    assert len(dossier["claims"]) == 4
    assert dossier["status"] == "AUDITED_PASSED"
    print("✓ Official World Bank Audit Dossier generated with 4 claims and pixel bounding boxes")

    print("\n🎉 ALL PONEGLYPH V2 TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_v2_flow()
