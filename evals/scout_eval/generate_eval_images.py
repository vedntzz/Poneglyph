"""Generate 12 synthetic test images for Scout agent evaluation.

Categories:
  - 4 clean typed English forms (eval_en_01–04)
  - 4 typed Hindi/bilingual forms (eval_hi_01–04)
  - 4 handwritten-style forms (eval_hw_01–04)

Each image has a companion ground_truth.json with expected evidence items.

"Handwritten-style" here means irregular font sizes, skewed baselines, and
ink-color text on a slightly noisy background — the best we can simulate with
PIL. Real handwritten Hindi forms would be better, but we don't have them.
This is documented in FAILURE_MODES.md as a known eval limitation.

Run from the repo root:
  cd backend && uv run python ../evals/scout_eval/generate_eval_images.py
"""

from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path(__file__).parent
W, H = 1500, 2000
BG = (255, 255, 255)
TEXT = (20, 20, 20)
LINE = (180, 180, 180)
HDR = (40, 40, 120)


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


# ──────────────────────────────────────────────
# English forms (eval_en_01 .. eval_en_04)
# ──────────────────────────────────────────────

def gen_en_01() -> dict:
    """Seed distribution form — Sagar district."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(36), _font(24), _font(20)
    y = 60

    d.text((100, y), "SEED DISTRIBUTION RECORD", fill=HDR, font=fl); y += 60
    d.line([(80, y), (1420, y)], fill=LINE, width=2); y += 30
    for label, val in [
        ("Project:", "MP-FPC Support (World Bank)"),
        ("Activity:", "Certified seed distribution to FPC members"),
        ("District:", "Sagar"),
        ("Block:", "Rehli"),
        ("Date:", "22 March 2026"),
        ("Indicator:", "Output 1.3 (Seed kits distributed)"),
    ]:
        d.text((100, y), label, fill=HDR, font=fm)
        d.text((420, y), val, fill=TEXT, font=fm); y += 40
    y += 20
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 20

    d.text((100, y), "S.No.", fill=HDR, font=fm)
    d.text((220, y), "Farmer Name", fill=HDR, font=fm)
    d.text((600, y), "FPC", fill=HDR, font=fm)
    d.text((900, y), "Crop", fill=HDR, font=fm)
    d.text((1150, y), "Qty (kg)", fill=HDR, font=fm); y += 35
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 10

    rows = [
        ("1", "Ramprasad Yadav", "Rehli FPC-1", "Wheat", "25"),
        ("2", "Geeta Devi", "Rehli FPC-1", "Wheat", "25"),
        ("3", "Hari Om Sahu", "Rehli FPC-1", "Gram", "15"),
        ("4", "Kamala Bai", "Rehli FPC-1", "Wheat", "25"),
        ("5", "Vijay Kushwaha", "Sagar FPC-3", "Mustard", "10"),
    ]
    for sno, name, fpc, crop, qty in rows:
        d.text((120, y), sno, fill=TEXT, font=fs)
        d.text((220, y), name, fill=TEXT, font=fs)
        d.text((600, y), fpc, fill=TEXT, font=fs)
        d.text((900, y), crop, fill=TEXT, font=fs)
        d.text((1170, y), qty, fill=TEXT, font=fs); y += 35

    y += 10
    d.text((100, y), "... (rows 6-35 on attached sheets)", fill=(120,120,120), font=fs); y += 40
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 30
    d.text((100, y), "Total farmers served: 35", fill=TEXT, font=fm); y += 40
    d.text((100, y), "Total seed distributed: 720 kg", fill=TEXT, font=fm); y += 40
    d.text((100, y), "Women farmers: 14 (40%)", fill=TEXT, font=fm); y += 80
    d.text((100, y), "Distribution Officer: Ram Narayan, Block Coordinator", fill=TEXT, font=fs)

    img.save(OUTPUT_DIR / "eval_en_01.png")
    return {
        "image": "eval_en_01.png",
        "category": "english_typed",
        "description": "Seed distribution record — Rehli block, Sagar",
        "expected_evidence_count": {"min": 3, "max": 6},
        "key_facts": [
            {"fact": "35 farmers served", "indicator": "Output 1.3"},
            {"fact": "720 kg seed distributed", "indicator": "Output 1.3"},
            {"fact": "14 women farmers (40%)", "indicator": "Output 1.3"},
            {"fact": "District Sagar, Block Rehli", "indicator": None},
            {"fact": "Date 22 March 2026", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


def gen_en_02() -> dict:
    """FPC registration summary — Damoh district."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(36), _font(24), _font(20)
    y = 60

    d.text((100, y), "FPC REGISTRATION SUMMARY", fill=HDR, font=fl); y += 60
    d.line([(80, y), (1420, y)], fill=LINE, width=2); y += 30
    for label, val in [
        ("Project:", "MP-FPC Support (World Bank)"),
        ("District:", "Damoh"),
        ("Reporting Period:", "Q1 2026 (Jan–Mar)"),
        ("Prepared by:", "Ankit Verma, District Coordinator"),
        ("Indicator:", "Output 1.1 (FPCs registered)"),
    ]:
        d.text((100, y), label, fill=HDR, font=fm)
        d.text((480, y), val, fill=TEXT, font=fm); y += 40
    y += 20
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 20

    d.text((100, y), "Block", fill=HDR, font=fm)
    d.text((400, y), "FPCs Registered", fill=HDR, font=fm)
    d.text((700, y), "Members", fill=HDR, font=fm)
    d.text((950, y), "Women Members", fill=HDR, font=fm)
    d.text((1250, y), "Status", fill=HDR, font=fm); y += 35
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 10

    blocks = [
        ("Damoh", "3", "156", "62 (40%)", "Active"),
        ("Hatta", "2", "98", "41 (42%)", "Active"),
        ("Batiyagarh", "1", "52", "18 (35%)", "Pending audit"),
        ("Patharia", "2", "110", "39 (35%)", "Active"),
    ]
    for block, fpcs, members, women, status in blocks:
        d.text((120, y), block, fill=TEXT, font=fs)
        d.text((450, y), fpcs, fill=TEXT, font=fs)
        d.text((730, y), members, fill=TEXT, font=fs)
        d.text((970, y), women, fill=TEXT, font=fs)
        d.text((1260, y), status, fill=TEXT, font=fs); y += 35

    y += 10
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 30
    d.text((100, y), "Total FPCs registered in Q1: 8", fill=TEXT, font=fm); y += 40
    d.text((100, y), "Total members enrolled: 416", fill=TEXT, font=fm); y += 40
    d.text((100, y), "Women membership rate: 38.5%", fill=TEXT, font=fm); y += 40
    d.text((100, y), "Target: 15 FPCs by Q3 2026", fill=TEXT, font=fm)

    img.save(OUTPUT_DIR / "eval_en_02.png")
    return {
        "image": "eval_en_02.png",
        "category": "english_typed",
        "description": "FPC registration summary — Damoh district Q1",
        "expected_evidence_count": {"min": 3, "max": 7},
        "key_facts": [
            {"fact": "8 FPCs registered in Q1", "indicator": "Output 1.1"},
            {"fact": "416 total members enrolled", "indicator": "Output 1.1"},
            {"fact": "38.5% women membership rate", "indicator": "Output 1.1"},
            {"fact": "Target 15 FPCs by Q3 2026", "indicator": "Output 1.1"},
            {"fact": "Batiyagarh FPC pending audit", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


def gen_en_03() -> dict:
    """AgriMart monthly report — Sagar."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(36), _font(24), _font(20)
    y = 60

    d.text((100, y), "AGRIMART MONTHLY OPERATIONS REPORT", fill=HDR, font=fl); y += 60
    d.line([(80, y), (1420, y)], fill=LINE, width=2); y += 30
    for label, val in [
        ("AgriMart ID:", "AM-SGR-014"),
        ("Location:", "Banda Block, Sagar District"),
        ("Month:", "March 2026"),
        ("Manager:", "Sunil Rajput"),
        ("Indicator:", "Output 2.2 (AgriMarts operational)"),
    ]:
        d.text((100, y), label, fill=HDR, font=fm)
        d.text((420, y), val, fill=TEXT, font=fm); y += 40
    y += 20
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 20

    d.text((100, y), "SALES SUMMARY — March 2026", fill=HDR, font=fm); y += 40
    sales = [
        ("Fertilizer (DAP)", "2.5 MT", "Rs 72,500"),
        ("Certified Seeds", "800 kg", "Rs 48,000"),
        ("Pesticides", "120 liters", "Rs 36,000"),
        ("Tools & Equipment", "45 units", "Rs 22,500"),
    ]
    d.text((120, y), "Product", fill=HDR, font=fs)
    d.text((550, y), "Quantity", fill=HDR, font=fs)
    d.text((900, y), "Revenue", fill=HDR, font=fs); y += 35
    d.line([(100, y), (1200, y)], fill=LINE, width=1); y += 10
    for product, qty, rev in sales:
        d.text((120, y), product, fill=TEXT, font=fs)
        d.text((570, y), qty, fill=TEXT, font=fs)
        d.text((910, y), rev, fill=TEXT, font=fs); y += 35
    y += 10
    d.line([(100, y), (1200, y)], fill=LINE, width=1); y += 15
    d.text((120, y), "Total Revenue:", fill=HDR, font=fm)
    d.text((570, y), "Rs 1,79,000", fill=TEXT, font=fm); y += 40
    d.text((120, y), "Farmers served this month:", fill=HDR, font=fm)
    d.text((650, y), "89", fill=TEXT, font=fm); y += 40
    d.text((120, y), "Women customers:", fill=HDR, font=fm)
    d.text((650, y), "31 (35%)", fill=TEXT, font=fm); y += 60

    d.text((100, y), "STATUS: FULLY OPERATIONAL", fill=(20, 100, 20), font=fm)

    img.save(OUTPUT_DIR / "eval_en_03.png")
    return {
        "image": "eval_en_03.png",
        "category": "english_typed",
        "description": "AgriMart monthly operations report — Banda block",
        "expected_evidence_count": {"min": 3, "max": 7},
        "key_facts": [
            {"fact": "Rs 1,79,000 total revenue March 2026", "indicator": "Output 2.2"},
            {"fact": "89 farmers served", "indicator": "Output 2.2"},
            {"fact": "31 women customers (35%)", "indicator": "Output 2.2"},
            {"fact": "AgriMart AM-SGR-014 fully operational", "indicator": "Output 2.2"},
        ],
        "expected_source_type": "field_form",
    }


def gen_en_04() -> dict:
    """Soil testing camp report — Khurai block."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(36), _font(24), _font(20)
    y = 60

    d.text((100, y), "SOIL TESTING CAMP — COMPLETION REPORT", fill=HDR, font=fl); y += 60
    d.line([(80, y), (1420, y)], fill=LINE, width=2); y += 30
    for label, val in [
        ("Camp Date:", "15 March 2026"),
        ("Block:", "Khurai"),
        ("District:", "Sagar"),
        ("Venue:", "Gram Panchayat Bhavan, Khurai"),
        ("Organized by:", "KVK Sagar + Synergy Technofin"),
        ("Indicator:", "Output 3.1 (Technical training camps)"),
    ]:
        d.text((100, y), label, fill=HDR, font=fm)
        d.text((480, y), val, fill=TEXT, font=fm); y += 40
    y += 20
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 20

    d.text((100, y), "PARTICIPATION", fill=HDR, font=fm); y += 35
    d.text((120, y), "Total farmers attended: 63", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Women farmers: 28 (44%)", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Soil samples collected: 63", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Soil health cards issued on-site: 48", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Remaining 15 cards to be mailed within 2 weeks", fill=TEXT, font=fm); y += 60

    d.text((100, y), "KEY FINDINGS", fill=HDR, font=fm); y += 35
    d.text((120, y), "- 72% of samples show nitrogen deficiency", fill=TEXT, font=fs); y += 30
    d.text((120, y), "- 45% show low organic carbon content", fill=TEXT, font=fs); y += 30
    d.text((120, y), "- Recommended: shift from DAP to urea + organic manure", fill=TEXT, font=fs); y += 60

    d.text((100, y), "Camp Coordinator: Dr. Pradeep Mishra, KVK Sagar", fill=TEXT, font=fs)

    img.save(OUTPUT_DIR / "eval_en_04.png")
    return {
        "image": "eval_en_04.png",
        "category": "english_typed",
        "description": "Soil testing camp report — Khurai block",
        "expected_evidence_count": {"min": 3, "max": 7},
        "key_facts": [
            {"fact": "63 farmers attended", "indicator": "Output 3.1"},
            {"fact": "28 women farmers (44%)", "indicator": "Output 3.1"},
            {"fact": "63 soil samples collected", "indicator": "Output 3.1"},
            {"fact": "48 soil health cards issued on-site", "indicator": "Output 3.1"},
            {"fact": "72% nitrogen deficiency", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


# ──────────────────────────────────────────────
# Hindi/bilingual typed forms (eval_hi_01..04)
# ──────────────────────────────────────────────

def gen_hi_01() -> dict:
    """SHG meeting register — bilingual Hindi/English."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(36), _font(24), _font(20)
    y = 60

    d.text((100, y), "SAMOOH BAITHAK REGISTER / SHG MEETING REGISTER", fill=HDR, font=fl); y += 60
    d.line([(80, y), (1420, y)], fill=LINE, width=2); y += 30
    for label, val in [
        ("Samooh / SHG:", "Lakshmi Swayam Sahayata Samooh"),
        ("Gaon / Village:", "Gumla"),
        ("Zila / District:", "Damoh"),
        ("Tarikh / Date:", "10 March 2026"),
        ("Baithak sankhya / Meeting No.:", "24"),
    ]:
        d.text((100, y), label, fill=HDR, font=fm)
        d.text((600, y), val, fill=TEXT, font=fm); y += 40
    y += 20
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 20

    d.text((100, y), "UPASTHITI / ATTENDANCE", fill=HDR, font=fm); y += 35
    d.text((120, y), "Kul sadasya / Total members: 15", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Upasthit / Present: 12", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Anupasthit / Absent: 3 (Kamla, Rani, Durga)", fill=TEXT, font=fm); y += 50

    d.text((100, y), "BACHAT / SAVINGS THIS MONTH", fill=HDR, font=fm); y += 35
    d.text((120, y), "Pratyek sadasya / Per member: Rs 200", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Kul bachat / Total collected: Rs 2,400", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Samooh kosh / Group fund balance: Rs 28,600", fill=TEXT, font=fm); y += 50

    d.text((100, y), "NIRNAY / DECISIONS", fill=HDR, font=fm); y += 35
    d.text((120, y), "1. Apply for bank linkage loan of Rs 50,000", fill=TEXT, font=fs); y += 30
    d.text((120, y), "2. Purchase seed kits from AgriMart (bulk order)", fill=TEXT, font=fs); y += 30
    d.text((120, y), "3. Next PHM training on 25 March — all must attend", fill=TEXT, font=fs); y += 60

    d.text((100, y), "Adhyaksh / President: Savitri Bai", fill=TEXT, font=fs); y += 30
    d.text((100, y), "Sachiv / Secretary: Meena Yadav", fill=TEXT, font=fs)

    img.save(OUTPUT_DIR / "eval_hi_01.png")
    return {
        "image": "eval_hi_01.png",
        "category": "hindi_typed",
        "description": "SHG meeting register — Lakshmi SHG, Gumla",
        "expected_evidence_count": {"min": 3, "max": 6},
        "key_facts": [
            {"fact": "12 of 15 members present", "indicator": None},
            {"fact": "Rs 2,400 savings collected", "indicator": None},
            {"fact": "Group fund balance Rs 28,600", "indicator": None},
            {"fact": "Decided to apply for Rs 50,000 bank linkage loan", "indicator": None},
            {"fact": "Village Gumla, District Damoh", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


def gen_hi_02() -> dict:
    """Kisan mela attendance — bilingual."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(36), _font(24), _font(20)
    y = 60

    d.text((100, y), "KISAN MELA UPASTHITI / FARMER FAIR ATTENDANCE", fill=HDR, font=fl); y += 60
    d.line([(80, y), (1420, y)], fill=LINE, width=2); y += 30
    for label, val in [
        ("Aayojan / Event:", "Kisan Mela — Rabi Season Showcase"),
        ("Tarikh / Date:", "8 February 2026"),
        ("Sthan / Venue:", "Block Office Compound, Rehli"),
        ("Zila / District:", "Sagar"),
        ("Aayojak / Organizer:", "ATMA Sagar + Synergy Technofin"),
        ("Lakshya / Indicator:", "Output 3.3 (Farmer outreach events)"),
    ]:
        d.text((100, y), label, fill=HDR, font=fm)
        d.text((550, y), val, fill=TEXT, font=fm); y += 40
    y += 20
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 20

    d.text((100, y), "BHAGIDARI / PARTICIPATION SUMMARY", fill=HDR, font=fm); y += 35
    d.text((120, y), "Kul kisan / Total farmers: 215", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Mahila kisan / Women farmers: 78 (36%)", fill=TEXT, font=fm); y += 35
    d.text((120, y), "FPC sadasya / FPC members: 142", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Non-FPC visitors: 73", fill=TEXT, font=fm); y += 50

    d.text((100, y), "STALL VIVARAN / STALL DETAILS", fill=HDR, font=fm); y += 35
    d.text((120, y), "- 5 input supplier stalls (seeds, fertilizer, tools)", fill=TEXT, font=fs); y += 30
    d.text((120, y), "- 3 FPC product display stalls", fill=TEXT, font=fs); y += 30
    d.text((120, y), "- 1 soil testing demonstration counter", fill=TEXT, font=fs); y += 30
    d.text((120, y), "- 1 bank linkage information desk (SBI, NABARD)", fill=TEXT, font=fs); y += 50

    d.text((100, y), "PRATIKUL / FEEDBACK", fill=HDR, font=fm); y += 35
    d.text((120, y), "86% of surveyed farmers rated event 'useful' or 'very useful'", fill=TEXT, font=fs); y += 30
    d.text((120, y), "Top request: more soil testing camps in individual villages", fill=TEXT, font=fs)

    img.save(OUTPUT_DIR / "eval_hi_02.png")
    return {
        "image": "eval_hi_02.png",
        "category": "hindi_typed",
        "description": "Kisan Mela attendance report — Rehli, Sagar",
        "expected_evidence_count": {"min": 3, "max": 7},
        "key_facts": [
            {"fact": "215 total farmers attended", "indicator": "Output 3.3"},
            {"fact": "78 women farmers (36%)", "indicator": "Output 3.3"},
            {"fact": "142 FPC members", "indicator": "Output 3.3"},
            {"fact": "86% rated event useful/very useful", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


def gen_hi_03() -> dict:
    """Warehouse receipt — bilingual."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(36), _font(24), _font(20)
    y = 60

    d.text((100, y), "GODOWN RASEED / WAREHOUSE RECEIPT", fill=HDR, font=fl); y += 60
    d.line([(80, y), (1420, y)], fill=LINE, width=2); y += 30
    for label, val in [
        ("Raseed sankhya / Receipt No.:", "WR-2026-0087"),
        ("Godown / Warehouse:", "Rehli Cold Storage Unit #1"),
        ("Jama tarikh / Deposit Date:", "5 April 2026"),
        ("Zila / District:", "Sagar"),
        ("Maal ka vivaran / Commodity:", "Potato (Kufri Jyoti variety)"),
    ]:
        d.text((100, y), label, fill=HDR, font=fm)
        d.text((620, y), val, fill=TEXT, font=fm); y += 40
    y += 20
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 20

    d.text((100, y), "JAMA VIVARAN / DEPOSIT DETAILS", fill=HDR, font=fm); y += 35
    d.text((120, y), "Jamaakarta / Depositor: Sagar FPC-3", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Matra / Quantity: 45 MT", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Shreni / Grade: A (sorted, cleaned)", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Bag sankhya / No. of bags: 900 (50 kg each)", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Storage temp / Taapman: 4°C", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Expected retrieval: 15 June 2026", fill=TEXT, font=fm); y += 50

    d.text((100, y), "SHULK / CHARGES", fill=HDR, font=fm); y += 35
    d.text((120, y), "Storage rate: Rs 1.50/kg/month", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Insurance: Rs 0.25/kg/month", fill=TEXT, font=fm); y += 35
    d.text((120, y), "Total monthly charge: Rs 78,750", fill=TEXT, font=fm); y += 60

    d.text((100, y), "Godown Prabandhan / Manager: Vikram Singh", fill=TEXT, font=fs); y += 30
    d.text((100, y), "Mohar / Stamp: [REHLI COLD STORAGE UNIT #1]", fill=TEXT, font=fs)

    img.save(OUTPUT_DIR / "eval_hi_03.png")
    return {
        "image": "eval_hi_03.png",
        "category": "hindi_typed",
        "description": "Warehouse receipt — Rehli cold storage, potato deposit",
        "expected_evidence_count": {"min": 3, "max": 6},
        "key_facts": [
            {"fact": "45 MT potato deposited by Sagar FPC-3", "indicator": "Output 2.1"},
            {"fact": "900 bags at 50 kg each", "indicator": None},
            {"fact": "Storage temperature 4°C", "indicator": None},
            {"fact": "Receipt WR-2026-0087", "indicator": None},
            {"fact": "Expected retrieval 15 June 2026", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


def gen_hi_04() -> dict:
    """FPC board resolution — bilingual."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(36), _font(24), _font(20)
    y = 60

    d.text((100, y), "SANKALP PATRA / BOARD RESOLUTION", fill=HDR, font=fl); y += 60
    d.line([(80, y), (1420, y)], fill=LINE, width=2); y += 30
    for label, val in [
        ("Sanghatan / Organization:", "Rehli Farmer Producer Company Ltd."),
        ("Sankalp tarikh / Date:", "20 March 2026"),
        ("Sankalp sankhya / Resolution No.:", "FPC-R-2026-012"),
        ("Adhyaksh / Chairperson:", "Govind Patel"),
    ]:
        d.text((100, y), label, fill=HDR, font=fm)
        d.text((620, y), val, fill=TEXT, font=fm); y += 40
    y += 20
    d.line([(80, y), (1420, y)], fill=LINE, width=1); y += 20

    d.text((100, y), "UPASTHITI / BOARD MEMBERS PRESENT", fill=HDR, font=fm); y += 35
    d.text((120, y), "1. Govind Patel (Chair) 2. Sunita Devi (Vice Chair)", fill=TEXT, font=fs); y += 30
    d.text((120, y), "3. Ramesh Yadav 4. Kamala Bai 5. Hari Sahu", fill=TEXT, font=fs); y += 30
    d.text((120, y), "6. Meena Patel 7. Vijay Kushwaha", fill=TEXT, font=fs); y += 30
    d.text((120, y), "Quorum achieved: 7 of 9 directors present", fill=TEXT, font=fm); y += 50

    d.text((100, y), "PRASTAVIT SANKALP / RESOLUTIONS PASSED", fill=HDR, font=fm); y += 40
    d.text((120, y), "R1: Approved application for NABARD equity grant of Rs 15 lakhs", fill=TEXT, font=fs); y += 30
    d.text((120, y), "R2: Appointed M/s Gupta & Associates as statutory auditor FY26", fill=TEXT, font=fs); y += 30
    d.text((120, y), "R3: Authorized purchase of 1 mini truck for FPC logistics", fill=TEXT, font=fs); y += 30
    d.text((120, y), "    (budget: Rs 8 lakhs, from working capital)", fill=TEXT, font=fs); y += 30
    d.text((120, y), "R4: Approved membership drive target: 50 new members by June", fill=TEXT, font=fs); y += 50

    d.text((100, y), "Sarvsammati se parit / Passed unanimously", fill=(20,100,20), font=fm); y += 60
    d.text((100, y), "Secretary: Sunita Devi", fill=TEXT, font=fs)

    img.save(OUTPUT_DIR / "eval_hi_04.png")
    return {
        "image": "eval_hi_04.png",
        "category": "hindi_typed",
        "description": "FPC board resolution — Rehli FPC",
        "expected_evidence_count": {"min": 3, "max": 7},
        "key_facts": [
            {"fact": "7 of 9 directors present, quorum achieved", "indicator": None},
            {"fact": "Approved NABARD equity grant application Rs 15 lakhs", "indicator": "Output 1.1"},
            {"fact": "Mini truck purchase approved Rs 8 lakhs", "indicator": None},
            {"fact": "Membership drive target 50 new members by June", "indicator": "Output 1.2"},
        ],
        "expected_source_type": "field_form",
    }


# ──────────────────────────────────────────────
# Handwritten-style forms (eval_hw_01..04)
# ──────────────────────────────────────────────
# These simulate handwritten forms: slightly off-white background,
# irregular positioning, varied font sizes, ink-colored text.
# Real handwritten forms would be far harder. This is documented
# in FAILURE_MODES.md.

INK = (10, 10, 80)      # dark blue ink
PAPER = (250, 245, 235)  # off-white paper

def _jitter(base: int, spread: int = 5) -> int:
    """Add small random offset to simulate hand placement."""
    return base + random.randint(-spread, spread)


def gen_hw_01() -> dict:
    """Handwritten-style field visit note."""
    random.seed(42)
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(32), _font(22), _font(18)
    y = 80

    d.text((_jitter(100), y), "FIELD VISIT NOTE", fill=INK, font=fl); y += 55
    d.line([(80, _jitter(y)), (1400, _jitter(y))], fill=(160,160,160), width=1); y += 25

    lines = [
        "Date: 3 April 2026",
        "Village: Sanchi",
        "Block: Raisen",
        "District: Raisen",
        "Visited by: Meena Patel, Field Officer",
        "",
        "Purpose: Verify beneficiary count claim from",
        "FarmTrac report (claimed 82 active farmers)",
        "",
        "Findings:",
        "- Visited 3 farmer homes + FPC collection point",
        "- Spoke to 8 farmers directly",
        "- FPC collection point had records for 67 farmers",
        "  (not 82 as claimed in FarmTrac)",
        "- 15 names appear to be duplicate entries",
        "- Actual unique active farmers: 67",
        "",
        "Women farmers verified: 29 of 67 (43%)",
        "",
        "Issues flagged:",
        "- FarmTrac data entry includes duplicate phone",
        "  numbers — same farmer registered twice",
        "- Collection point register is handwritten,",
        "  no digital backup",
        "",
        "Recommendation: Data cleaning needed in FarmTrac",
        "for Raisen block. Cross-verify all blocks.",
        "",
        "Signed: Meena Patel",
    ]
    for line in lines:
        if line == "":
            y += 15
            continue
        d.text((_jitter(110, 8), _jitter(y, 3)), line, fill=INK, font=fm)
        y += 32

    img.save(OUTPUT_DIR / "eval_hw_01.png")
    return {
        "image": "eval_hw_01.png",
        "category": "handwritten_style",
        "description": "Field visit note — Sanchi village, data discrepancy",
        "expected_evidence_count": {"min": 2, "max": 5},
        "key_facts": [
            {"fact": "67 actual farmers vs 82 claimed in FarmTrac", "indicator": "Output 1.2"},
            {"fact": "15 duplicate entries in FarmTrac", "indicator": None},
            {"fact": "29 women farmers (43%)", "indicator": None},
            {"fact": "Village Sanchi, District Raisen", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


def gen_hw_02() -> dict:
    """Handwritten-style training feedback sheet."""
    random.seed(43)
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(32), _font(22), _font(18)
    y = 80

    d.text((_jitter(100), y), "PRASHIKSHAN FEEDBACK / TRAINING FEEDBACK", fill=INK, font=fl); y += 55
    d.line([(80, _jitter(y)), (1400, _jitter(y))], fill=(160,160,160), width=1); y += 25

    lines = [
        "Training: Organic Farming Practices",
        "Date: 28 Feb 2026",
        "Village: Patharia",
        "District: Damoh",
        "Trainer: Dr. Suresh Kumar, KVK Damoh",
        "Indicator: Output 3.1 (Technical training)",
        "",
        "Participants: 38 (24 men, 14 women)",
        "",
        "Feedback Summary (collected from 30 forms):",
        "- Content relevance: 4.2/5",
        "- Trainer quality: 4.5/5",
        "- Practical usefulness: 3.8/5",
        "- Would recommend: 28 of 30 (93%)",
        "",
        "Key takeaway for participants:",
        "- Vermicompost preparation technique",
        "- Neem-based pest management",
        "- Reducing chemical fertilizer by 30%",
        "",
        "Issues:",
        "- Training in Hindi only — 3 Gond tribal",
        "  farmers could not follow (speak Gondi)",
        "- No printed handout was provided",
        "",
        "Compiled by: Ankit Verma",
    ]
    for line in lines:
        if line == "":
            y += 15
            continue
        d.text((_jitter(110, 8), _jitter(y, 3)), line, fill=INK, font=fm)
        y += 32

    img.save(OUTPUT_DIR / "eval_hw_02.png")
    return {
        "image": "eval_hw_02.png",
        "category": "handwritten_style",
        "description": "Training feedback sheet — organic farming, Patharia",
        "expected_evidence_count": {"min": 3, "max": 6},
        "key_facts": [
            {"fact": "38 participants (24 men, 14 women)", "indicator": "Output 3.1"},
            {"fact": "Feedback: 4.2/5 relevance, 4.5/5 trainer, 3.8/5 practical", "indicator": None},
            {"fact": "93% would recommend", "indicator": None},
            {"fact": "3 Gond tribal farmers could not follow Hindi training", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


def gen_hw_03() -> dict:
    """Handwritten-style WhatsApp-transcribed field update."""
    random.seed(44)
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(32), _font(22), _font(18)
    y = 80

    d.text((_jitter(100), y), "WHATSAPP FIELD UPDATE — TRANSCRIBED", fill=INK, font=fl); y += 55
    d.line([(80, _jitter(y)), (1400, _jitter(y))], fill=(160,160,160), width=1); y += 25

    lines = [
        "From: Ankit Verma (District Coordinator)",
        "To: Project WhatsApp Group",
        "Date: 10 April 2026",
        "Time: 18:45",
        "",
        "Message:",
        "\"Sagar district update — visited 3 AgriMarts",
        "today. AM-SGR-008 (Banda) fully operational,",
        "good footfall. AM-SGR-011 (Khurai) has stock",
        "issues — fertilizer supply delayed 2 weeks,",
        "farmers complaining. AM-SGR-015 (Rehli) not yet",
        "open — gram panchayat MoU pending signature.\"",
        "",
        "\"Training materials for PHM module 3 ready.",
        "Meena didi reviewed and approved. Will start",
        "distribution to field staff Monday.\"",
        "",
        "\"Attached: 3 photos of AgriMarts (see below)\"",
        "",
        "Photos attached: [3 thumbnails shown]",
        "",
        "Transcribed by: Office assistant, 11 Apr 2026",
    ]
    for line in lines:
        if line == "":
            y += 15
            continue
        d.text((_jitter(110, 8), _jitter(y, 3)), line, fill=INK, font=fm)
        y += 32

    img.save(OUTPUT_DIR / "eval_hw_03.png")
    return {
        "image": "eval_hw_03.png",
        "category": "handwritten_style",
        "description": "Transcribed WhatsApp field update — AgriMart status",
        "expected_evidence_count": {"min": 2, "max": 5},
        "key_facts": [
            {"fact": "AM-SGR-008 fully operational", "indicator": "Output 2.2"},
            {"fact": "AM-SGR-011 stock issues, fertilizer delayed 2 weeks", "indicator": "Output 2.2"},
            {"fact": "AM-SGR-015 not yet open, MoU pending", "indicator": "Output 2.2"},
            {"fact": "PHM module 3 training materials ready", "indicator": "Output 3.2"},
        ],
        "expected_source_type": "whatsapp",
    }


def gen_hw_04() -> dict:
    """Handwritten-style FPC financial summary (messy, partial)."""
    random.seed(45)
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    fl, fm, fs = _font(32), _font(22), _font(18)
    y = 80

    d.text((_jitter(100), y), "FPC MONTHLY FINANCIAL — ROUGH NOTES", fill=INK, font=fl); y += 55
    d.line([(80, _jitter(y)), (1400, _jitter(y))], fill=(160,160,160), width=1); y += 25

    lines = [
        "FPC: Banda FPC-2",
        "Month: March 2026",
        "Prepared by: accountant (handwritten)",
        "",
        "Revenue:",
        "  Input sales (seeds, fert): Rs 1,23,000",
        "  Output aggregation (potato): Rs 2,45,000",
        "  Service charges: Rs 12,000",
        "  TOTAL REVENUE: Rs 3,80,000",
        "",
        "Expenses:",
        "  Procurement: Rs 2,10,000",
        "  Transport: Rs 35,000",
        "  Staff salary (3): Rs 45,000",
        "  Rent + utilities: Rs 18,000",
        "  Misc: Rs 8,500",
        "  TOTAL EXPENSES: Rs 3,16,500",
        "",
        "NET SURPLUS: Rs 63,500",
        "",
        "Members served this month: 156",
        "Active AgriMart transactions: 89",
        "",
        "Note: Rs 15,000 outstanding from Rehli",
        "FPC-1 for shared transport — follow up",
        "",
        "UNVERIFIED — pending CA review",
    ]
    for line in lines:
        if line == "":
            y += 15
            continue
        d.text((_jitter(110, 8), _jitter(y, 3)), line, fill=INK, font=fm)
        y += 32

    img.save(OUTPUT_DIR / "eval_hw_04.png")
    return {
        "image": "eval_hw_04.png",
        "category": "handwritten_style",
        "description": "FPC rough financial notes — Banda FPC-2, March 2026",
        "expected_evidence_count": {"min": 2, "max": 6},
        "key_facts": [
            {"fact": "Total revenue Rs 3,80,000", "indicator": None},
            {"fact": "Net surplus Rs 63,500", "indicator": None},
            {"fact": "156 members served", "indicator": "Output 1.2"},
            {"fact": "89 active AgriMart transactions", "indicator": "Output 2.2"},
            {"fact": "Unverified — pending CA review", "indicator": None},
        ],
        "expected_source_type": "field_form",
    }


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

if __name__ == "__main__":
    generators = [
        gen_en_01, gen_en_02, gen_en_03, gen_en_04,
        gen_hi_01, gen_hi_02, gen_hi_03, gen_hi_04,
        gen_hw_01, gen_hw_02, gen_hw_03, gen_hw_04,
    ]

    all_ground_truth = []
    for gen_fn in generators:
        gt = gen_fn()
        all_ground_truth.append(gt)
        print(f"  Generated: {gt['image']} ({gt['category']})")

    gt_path = OUTPUT_DIR / "ground_truth.json"
    with open(gt_path, "w") as f:
        json.dump(all_ground_truth, f, indent=2)

    print(f"\nGround truth written to: {gt_path}")
    print(f"Total test cases: {len(all_ground_truth)}")
