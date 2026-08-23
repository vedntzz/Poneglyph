"""Generate synthetic test images for Scout agent testing.

Creates two images that simulate scanned field forms:
1. form_english.png — typed English text, simple beneficiary registration form
2. form_hindi.png — typed Hindi text, PHM training attendance record

These are stand-ins for real scanned forms. The text is typed (not
handwritten) and the layout is simple, because the goal is to test
Scout's extraction pipeline, not OCR on messy handwriting. Real
Hindi handwritten forms will be swapped in later.

Run: cd backend && uv run python ../data/synthetic/generate_test_images.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

OUTPUT_DIR = Path(__file__).parent
IMAGE_WIDTH = 1500
IMAGE_HEIGHT = 2000
BACKGROUND_COLOR = (255, 255, 255)
TEXT_COLOR = (20, 20, 20)
LINE_COLOR = (180, 180, 180)
HEADER_COLOR = (40, 40, 120)


def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Get a font, falling back to default if no system font found."""
    # Try common system font paths
    font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ]
    for path in font_paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def generate_english_form() -> Path:
    """Generate a synthetic English beneficiary registration form."""
    img = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)
    font_large = _get_font(36)
    font_medium = _get_font(24)
    font_small = _get_font(20)

    y = 60

    # Header
    draw.text((100, y), "BENEFICIARY REGISTRATION FORM", fill=HEADER_COLOR, font=font_large)
    y += 60
    draw.line([(80, y), (1420, y)], fill=LINE_COLOR, width=2)
    y += 30

    # Project info
    draw.text((100, y), "Project: MP Farmer Producer Company Support", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Donor: World Bank", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "District: Sagar", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Village: Rahatgarh", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Date: 18 April 2026", fill=TEXT_COLOR, font=font_medium)
    y += 60

    draw.line([(80, y), (1420, y)], fill=LINE_COLOR, width=2)
    y += 30

    # Table header
    draw.text((100, y), "S.No.", fill=HEADER_COLOR, font=font_medium)
    draw.text((220, y), "Name", fill=HEADER_COLOR, font=font_medium)
    draw.text((620, y), "Gender", fill=HEADER_COLOR, font=font_medium)
    draw.text((820, y), "Phone", fill=HEADER_COLOR, font=font_medium)
    draw.text((1080, y), "Signature", fill=HEADER_COLOR, font=font_medium)
    y += 40
    draw.line([(80, y), (1420, y)], fill=LINE_COLOR, width=1)
    y += 15

    # Sample rows
    rows = [
        ("1", "Ramesh Kumar", "M", "9876543210", "[signed]"),
        ("2", "Sunita Devi", "F", "9876543211", "[signed]"),
        ("3", "Mohan Lal", "M", "9876543212", "[signed]"),
        ("4", "Priya Sharma", "F", "9876543213", "[signed]"),
        ("5", "Ganesh Patel", "M", "9876543214", "[signed]"),
    ]
    for sno, name, gender, phone, sig in rows:
        draw.text((120, y), sno, fill=TEXT_COLOR, font=font_small)
        draw.text((220, y), name, fill=TEXT_COLOR, font=font_small)
        draw.text((640, y), gender, fill=TEXT_COLOR, font=font_small)
        draw.text((820, y), phone, fill=TEXT_COLOR, font=font_small)
        draw.text((1080, y), sig, fill=TEXT_COLOR, font=font_small)
        y += 35

    y += 20
    draw.line([(80, y), (1420, y)], fill=LINE_COLOR, width=1)
    y += 30

    # Summary
    draw.text(
        (100, y),
        "Total beneficiaries registered: 47",
        fill=TEXT_COLOR,
        font=font_medium,
    )
    y += 40
    draw.text(
        (100, y),
        "Women beneficiaries: 19 (40%)",
        fill=TEXT_COLOR,
        font=font_medium,
    )
    y += 40
    draw.text(
        (100, y),
        "Target indicator: Output 1.2 (Farmers enrolled)",
        fill=TEXT_COLOR,
        font=font_medium,
    )
    y += 80

    # Officer signature block
    draw.text((100, y), "Verified by:", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Village Development Officer, Rahatgarh", fill=TEXT_COLOR, font=font_small)
    y += 30
    draw.text((100, y), "Stamp: [DISTRICT COLLECTOR OFFICE SAGAR]", fill=TEXT_COLOR, font=font_small)

    output_path = OUTPUT_DIR / "form_english.png"
    img.save(output_path)
    print(f"Generated: {output_path} ({IMAGE_WIDTH}x{IMAGE_HEIGHT})")
    return output_path


def generate_hindi_form() -> Path:
    """Generate a synthetic Hindi PHM training attendance form.

    Uses transliterated Hindi in Latin script since system fonts may not
    have Devanagari support. The key data points (numbers, dates, village
    names) are in English/digits so Scout can extract them reliably.
    """
    img = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)
    font_large = _get_font(36)
    font_medium = _get_font(24)
    font_small = _get_font(20)

    y = 60

    # Header — mixed Hindi transliteration and English
    draw.text(
        (100, y),
        "MAHILA PHM PRASHIKSHAN ATTENDANCE / Women's PHM Training",
        fill=HEADER_COLOR,
        font=font_large,
    )
    y += 60
    draw.line([(80, y), (1420, y)], fill=LINE_COLOR, width=2)
    y += 30

    # Training details
    draw.text((100, y), "Prashikshan / Training: Post-Harvest Management (PHM)", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Tarikh / Date: 18 April 2026", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Gaon / Village: Gumla", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Zila / District: Damoh", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Trainer: Dr. Anita Verma, KVK Damoh", fill=TEXT_COLOR, font=font_medium)
    y += 60

    draw.line([(80, y), (1420, y)], fill=LINE_COLOR, width=2)
    y += 30

    # Table header
    draw.text((100, y), "Kram / S.No.", fill=HEADER_COLOR, font=font_medium)
    draw.text((320, y), "Naam / Name", fill=HEADER_COLOR, font=font_medium)
    draw.text((720, y), "SHG", fill=HEADER_COLOR, font=font_medium)
    draw.text((980, y), "Hastakshar / Sign", fill=HEADER_COLOR, font=font_medium)
    y += 40
    draw.line([(80, y), (1420, y)], fill=LINE_COLOR, width=1)
    y += 15

    # Sample attendees
    attendees = [
        ("1", "Savitri Bai", "Lakshmi SHG"),
        ("2", "Kamla Devi", "Durga SHG"),
        ("3", "Meena Yadav", "Lakshmi SHG"),
        ("4", "Parvati Singh", "Saraswati SHG"),
        ("5", "Rekha Patel", "Durga SHG"),
        ("6", "Suman Tiwari", "Saraswati SHG"),
    ]
    for sno, name, shg in attendees:
        draw.text((130, y), sno, fill=TEXT_COLOR, font=font_small)
        draw.text((320, y), name, fill=TEXT_COLOR, font=font_small)
        draw.text((720, y), shg, fill=TEXT_COLOR, font=font_small)
        draw.text((1000, y), "[signed]", fill=TEXT_COLOR, font=font_small)
        y += 35

    y += 10
    draw.text((100, y), "... (rows 7-47 continue on attached sheets)", fill=(120, 120, 120), font=font_small)
    y += 40

    draw.line([(80, y), (1420, y)], fill=LINE_COLOR, width=1)
    y += 30

    # Summary section
    draw.text(
        (100, y),
        "Kul upasthiti / Total attendance: 47 mahilayen / 47 women",
        fill=TEXT_COLOR,
        font=font_medium,
    )
    y += 40
    draw.text(
        (100, y),
        "Logframe lakshya / Target indicator: Output 3.2 (Women's PHM trainings)",
        fill=TEXT_COLOR,
        font=font_medium,
    )
    y += 40
    draw.text(
        (100, y),
        "Prashikshan avadhi / Duration: 3 din / 3 days (16-18 April 2026)",
        fill=TEXT_COLOR,
        font=font_medium,
    )
    y += 80

    # Trainer signature
    draw.text((100, y), "Prashikshak / Trainer signature:", fill=TEXT_COLOR, font=font_medium)
    y += 40
    draw.text((100, y), "Dr. Anita Verma, Krishi Vigyan Kendra, Damoh", fill=TEXT_COLOR, font=font_small)
    y += 30
    draw.text((100, y), "Stamp: [KVK DAMOH]", fill=TEXT_COLOR, font=font_small)

    output_path = OUTPUT_DIR / "form_hindi.png"
    img.save(output_path)
    print(f"Generated: {output_path} ({IMAGE_WIDTH}x{IMAGE_HEIGHT})")
    return output_path


if __name__ == "__main__":
    generate_english_form()
    generate_hindi_form()
    print("\nDone. Test images ready for Scout.")
