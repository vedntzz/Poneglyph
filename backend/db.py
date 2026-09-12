"""Poneglyph V2 Database Layer — SQLite engine for Project Milestones, Field Evidence, Gaps, and Audit Dossiers.

Provides persistent relational storage for the Milestone & Invoice Defense Shield,
replacing hackathon flat-file memory.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(__file__).resolve().parent / "poneglyph_v2.db"


def get_connection() -> sqlite3.Connection:
    """Return an active SQLite connection with row_factory set to Row."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize database tables if they do not exist, and seed initial demo data."""
    conn = get_connection()
    cur = conn.cursor()

    # 1. Projects
    cur.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        donor_type TEXT NOT NULL,
        contract_code TEXT NOT NULL,
        contract_value_inr REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        description TEXT,
        created_at TEXT NOT NULL
    );
    """)

    # 2. Milestones
    cur.execute("""
    CREATE TABLE IF NOT EXISTS milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        logframe_code TEXT NOT NULL,
        target_quantity INTEGER NOT NULL,
        target_unit TEXT NOT NULL,
        verified_quantity INTEGER NOT NULL DEFAULT 0,
        partial_quantity INTEGER NOT NULL DEFAULT 0,
        missing_quantity INTEGER NOT NULL DEFAULT 0,
        invoice_amount_inr REAL NOT NULL,
        status TEXT NOT NULL, -- READY_FOR_INVOICE, BLOCKED_BY_GAPS, IN_REVIEW, PAID
        deadline TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    """)

    # 3. Evidence Items (Field registers, WhatsApp captures, photos, meetings)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS evidence_items (
        id TEXT PRIMARY KEY,
        milestone_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        source_type TEXT NOT NULL, -- whatsapp, scan, photo, meeting_transcript
        sender_name TEXT,
        sender_role TEXT,
        district TEXT,
        village TEXT,
        date_collected TEXT,
        image_url TEXT,
        extracted_text TEXT,
        bounding_boxes_json TEXT, -- JSON string of [{box_2d: [ymin, xmin, ymax, xmax], label, text}]
        confidence TEXT NOT NULL, -- HIGH, MEDIUM, LOW
        verification_status TEXT NOT NULL, -- VERIFIED, PARTIAL, UNVERIFIED, CONTESTED
        auditor_notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (milestone_id) REFERENCES milestones(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    """)

    # 4. Pre-Billing Gap Alerts
    cur.execute("""
    CREATE TABLE IF NOT EXISTS gap_alerts (
        id TEXT PRIMARY KEY,
        milestone_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        issue_type TEXT NOT NULL, -- MISSING_PROOF, CONTRADICTION, MoU_ONLY_NO_SITE, UNGROUNDED_CLAIM
        severity TEXT NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        dispatch_prompt_hindi TEXT,
        dispatch_prompt_english TEXT,
        target_recipient_phone TEXT,
        target_recipient_name TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, DISPATCHED, RESOLVED
        created_at TEXT NOT NULL,
        FOREIGN KEY (milestone_id) REFERENCES milestones(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    """)

    # 5. Audit Dossiers
    cur.execute("""
    CREATE TABLE IF NOT EXISTS dossiers (
        id TEXT PRIMARY KEY,
        milestone_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        donor_format TEXT NOT NULL, -- WORLD_BANK_ISR, GIZ_PROGRESS, PMU_INVOICE
        title TEXT NOT NULL,
        invoice_ref TEXT NOT NULL,
        total_claimed_inr REAL NOT NULL,
        claims_json TEXT NOT NULL, -- JSON array of atomic claims with evidence citations
        status TEXT NOT NULL, -- DRAFT, AUDITED_PASSED, SUBMITTED
        generated_at TEXT NOT NULL,
        FOREIGN KEY (milestone_id) REFERENCES milestones(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    """)

    conn.commit()

    # Check if demo project exists, if not seed it
    cur.execute("SELECT id FROM projects WHERE id = 'proj-mp-fpc'")
    if not cur.fetchone():
        seed_demo_data(conn)

    conn.close()


def seed_demo_data(conn: sqlite3.Connection) -> None:
    """Seed canonical demo project data: MP Farmer Producer Company (World Bank #WB-4091)."""
    cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()

    # 1. Seed Project
    cur.execute("""
    INSERT INTO projects (id, name, donor_type, contract_code, contract_value_inr, currency, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "proj-mp-fpc",
        "Madhya Pradesh Farmer Producer Company Program",
        "World Bank & MP State Agribusiness Board",
        "WB-4091-MP-AGRI",
        52000000.0, # ₹5.20 Crore
        "INR",
        "Strengthening 50 Farmer Producer Companies and establishing AgriMart input/output rural centers across central MP.",
        now,
    ))

    # 2. Seed Milestones
    cur.execute("""
    INSERT INTO milestones (id, project_id, title, logframe_code, target_quantity, target_unit, verified_quantity, partial_quantity, missing_quantity, invoice_amount_inr, status, deadline, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "ms-003",
        "proj-mp-fpc",
        "Milestone 3: 50 Operational AgriMarts & 500MT Storage Capacity",
        "Output 2.1",
        50,
        "AgriMarts",
        28, # 28 Verified with signed registers & stamped photos
        14, # 14 with signed MoUs but missing site photos
        8,  # 8 with zero field evidence
        4500000.0, # ₹45,00,000 Invoice Payment
        "BLOCKED_BY_GAPS",
        "2026-09-30",
        now,
    ))

    # 3. Seed Evidence Items (Field registers with pixel bounding boxes)
    sample_boxes_1 = [
        {
            "box_2d": [180, 120, 310, 880],
            "label": "TITLE_HEADER",
            "text": "SAMOOH BAITHAK REGISTER / SHG & AGRIMART MEETING REGISTER",
        },
        {
            "box_2d": [360, 140, 520, 890],
            "label": "OPERATIONAL_STAMP",
            "text": "सत्यापित केंद्र संख्या: 28 केंद्र विधिवत कार्यरत - Block Agribusiness Officer",
        },
        {
            "box_2d": [570, 140, 720, 890],
            "label": "DATE_AND_LOCATION",
            "text": "Sehore District · 12 March 2026 · GPS: 23.204° N, 77.085° E",
        },
    ]

    cur.execute("""
    INSERT INTO evidence_items (id, milestone_id, project_id, source_type, sender_name, sender_role, district, village, date_collected, image_url, extracted_text, bounding_boxes_json, confidence, verification_status, auditor_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "ev-082",
        "ms-003",
        "proj-mp-fpc",
        "whatsapp",
        "Rameshwar Patidar",
        "Block Coordinator, Sehore",
        "Sehore",
        "Shyampur",
        "2026-03-12",
        "/static/synthetic/form_hindi.png",
        "Verified 28 AgriMarts operational with active member attendance and certified weighing machines.",
        json.dumps(sample_boxes_1),
        "HIGH",
        "VERIFIED",
        "✓ Pixel-verified: Official stamp from Block Agribusiness Officer and member signatures present.",
        now,
    ))

    sample_boxes_2 = [
        {
            "box_2d": [140, 110, 260, 890],
            "label": "STORAGE_INSPECTION",
            "text": "500 MT WAREHOUSE & COLD STORAGE AUDIT REPORT",
        },
        {
            "box_2d": [320, 130, 480, 880],
            "label": "CAPACITY_UTILIZATION",
            "text": "Current Stored Stock: 120 MT (24% capacity) - Incomplete Insulation",
        },
    ]

    cur.execute("""
    INSERT INTO evidence_items (id, milestone_id, project_id, source_type, sender_name, sender_role, district, village, date_collected, image_url, extracted_text, bounding_boxes_json, confidence, verification_status, auditor_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "ev-094",
        "ms-003",
        "proj-mp-fpc",
        "whatsapp",
        "Vikram Singh",
        "Infrastructure Engineer",
        "Hoshangabad",
        "Babai",
        "2026-03-28",
        "/static/synthetic/form_cold_storage.png",
        "Cold storage warehouse capacity inspection: 120 MT verified operational, 380 MT remaining.",
        json.dumps(sample_boxes_2),
        "HIGH",
        "PARTIAL",
        "⚠ Partial verification: 120 MT capacity verified against 500 MT target. Insulation pending on Chambers 2 & 3.",
        now,
    ))

    # 4. Seed Pre-Billing Gap Alerts
    cur.execute("""
    INSERT INTO gap_alerts (id, milestone_id, project_id, issue_type, severity, title, description, recommended_action, dispatch_prompt_hindi, dispatch_prompt_english, target_recipient_phone, target_recipient_name, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "gap-001",
        "ms-003",
        "proj-mp-fpc",
        "MISSING_PROOF",
        "CRITICAL",
        "8 AgriMarts in Raisen District have zero field proof",
        "Target is 50 AgriMarts. 28 verified, 14 have signed MoUs only, 8 in Raisen have zero submitted photo or register proof. This will trigger a ₹12,00,000 deduction on the ₹45L invoice.",
        "Dispatch automated WhatsApp prompt to Raisen Block Coordinator requesting signboards & opening registers.",
        "नमस्ते महेश जी, रायसेन के 8 एग्रीमार्ट केंद्रों के उद्घाटन रजिस्टर और साइनबोर्ड की फोटो कृपया आज शाम तक इस व्हाट्सएप नंबर पर भेजें ताकि माइलस्टोन बिलिंग में लगाया जा सके।",
        "Dear Mahesh, please send photos of the inauguration registers and signboards for the 8 Raisen AgriMarts by this evening for milestone invoice clearance.",
        "+91 98260 12345",
        "Mahesh Sharma (Block Coordinator, Raisen)",
        "OPEN",
        now,
    ))

    cur.execute("""
    INSERT INTO gap_alerts (id, milestone_id, project_id, issue_type, severity, title, description, recommended_action, dispatch_prompt_hindi, dispatch_prompt_english, target_recipient_phone, target_recipient_name, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "gap-002",
        "ms-003",
        "proj-mp-fpc",
        "MoU_ONLY_NO_SITE",
        "HIGH",
        "14 AgriMarts have signed MoUs but no physical site inspection photos",
        "World Bank IEG guidelines mandate physical geo-tagged site photos alongside paper MoUs. Submitting MoUs alone will result in a compliance rating downgrade.",
        "Request geo-tagged GPS photos of the 14 retail premises from field officers.",
        "कृपया 14 एग्रीमार्ट परिसरों की जीपीएस युक्त फोटो (GPS camera photo) तुरंत भेजें।",
        "Please send GPS-tagged photos of the 14 leased AgriMart premises immediately.",
        "+91 94250 67890",
        "Sanjay Verma (State Field Manager)",
        "OPEN",
        now,
    ))

    # 5. Seed Dossier Draft
    claims = [
        {
            "claim_id": "cl-01",
            "text": "28 AgriMarts are fully operational with active member registers and weighing scales across Sehore District.",
            "evidence_id": "ev-082",
            "verification_status": "VERIFIED",
            "confidence": "HIGH",
            "evidence_snippet": "सत्यापित केंद्र संख्या: 28 केंद्र विधिवत कार्यरत - Block Agribusiness Officer",
            "image_url": "/static/synthetic/form_hindi.png",
            "bounding_box": [360, 140, 520, 890]
        },
        {
            "claim_id": "cl-02",
            "text": "120 MT cold storage capacity is active at the Babai facility; remaining 380 MT insulation scheduled for Q4.",
            "evidence_id": "ev-094",
            "verification_status": "PARTIAL",
            "confidence": "HIGH",
            "evidence_snippet": "Current Stored Stock: 120 MT (24% capacity) - Incomplete Insulation",
            "image_url": "/static/synthetic/form_cold_storage.png",
            "bounding_box": [320, 130, 480, 880]
        },
        {
            "claim_id": "cl-03",
            "text": "14 AgriMart premises have signed commercial lease agreements with local farmer producer companies.",
            "evidence_id": "ev-082",
            "verification_status": "PARTIAL",
            "confidence": "MEDIUM",
            "evidence_snippet": "14 centers with signed MoUs awaiting physical signage verification.",
            "image_url": "/static/synthetic/form_hindi.png",
            "bounding_box": [180, 120, 310, 880]
        }
    ]

    cur.execute("""
    INSERT INTO dossiers (id, milestone_id, project_id, donor_format, title, invoice_ref, total_claimed_inr, claims_json, status, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "dos-003",
        "ms-003",
        "proj-mp-fpc",
        "WORLD_BANK_ISR",
        "World Bank ISR & Milestone 3 Billing Dossier",
        "INV-2026-Q3-003",
        4500000.0,
        json.dumps(claims),
        "AUDITED_PASSED",
        now,
    ))

    conn.commit()


# Initialize database automatically upon module import
init_db()
