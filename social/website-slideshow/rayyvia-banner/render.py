from pathlib import Path
from typing import Optional, Tuple

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).with_name("rayyvia-lifestyle-base.png")
PNG_OUTPUT = ROOT / "public/products/rayyvia-sun-protect-slideshow-v2.png"
WEBP_OUTPUT = ROOT / "public/products/rayyvia-sun-protect-slideshow-v2.webp"

CANVAS_SIZE = (2880, 960)
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_BOLD_ITALIC = "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf"


def fit_font(text: str, font_path: str, max_size: int, max_width: int) -> ImageFont.FreeTypeFont:
    """Return the largest font at or below max_size that fits max_width."""
    size = max_size
    while size > 24:
        font = ImageFont.truetype(font_path, size)
        left, _, right, _ = font.getbbox(text)
        if right - left <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(font_path, size)


def centered_text(
    draw: ImageDraw.ImageDraw,
    center_x: int,
    center_y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: Tuple[int, int, int],
    shadow: Tuple[int, int, int],
    shadow_offset: Tuple[int, int],
    stroke_width: int = 0,
    stroke_fill: Optional[Tuple[int, int, int]] = None,
) -> None:
    shadow_x, shadow_y = shadow_offset
    draw.text(
        (center_x + shadow_x, center_y + shadow_y),
        text,
        font=font,
        fill=shadow,
        anchor="mm",
        stroke_width=stroke_width,
        stroke_fill=shadow if stroke_width else None,
    )
    draw.text(
        (center_x, center_y),
        text,
        font=font,
        fill=fill,
        anchor="mm",
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )


def render() -> None:
    image = Image.open(SOURCE).convert("RGB").resize(CANVAS_SIZE, Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)

    # The generated photography intentionally leaves this entire region clear.
    text_left = 1600
    text_right = 2805
    center_x = (text_left + text_right) // 2
    max_width = text_right - text_left

    navy = (5, 74, 128)
    white = (255, 255, 255)
    yellow = (255, 221, 24)
    violet = (98, 58, 154)

    kicker = "HELLO, SUNSHINE"
    kicker_font = fit_font(kicker, FONT_BOLD, 82, max_width - 120)
    centered_text(
        draw,
        center_x,
        220,
        kicker,
        kicker_font,
        yellow,
        navy,
        (5, 7),
        stroke_width=1,
        stroke_fill=(255, 228, 37),
    )

    headline = "MEET RAYYVIA"
    headline_font = fit_font(headline, FONT_BLACK, 138, max_width)
    centered_text(
        draw,
        center_x,
        360,
        headline,
        headline_font,
        white,
        navy,
        (7, 9),
        stroke_width=2,
        stroke_fill=white,
    )

    subline = "for your daily sun-care ritual"
    subline_font = fit_font(subline, FONT_BOLD_ITALIC, 52, max_width - 100)
    centered_text(
        draw,
        center_x,
        490,
        subline,
        subline_font,
        yellow,
        navy,
        (3, 4),
    )

    button_width = 570
    button_height = 126
    button_x0 = center_x - button_width // 2
    button_y0 = 628
    button_box = (button_x0, button_y0, button_x0 + button_width, button_y0 + button_height)

    # A soft shadow gives the pill the same lifted ecommerce-banner feel as the reference.
    shadow_box = tuple(value + offset for value, offset in zip(button_box, (0, 10, 0, 10)))
    draw.rounded_rectangle(shadow_box, radius=34, fill=(26, 114, 165))
    draw.rounded_rectangle(button_box, radius=34, fill=white)

    cta = "EXPLORE NOW  ›"
    cta_font = fit_font(cta, FONT_BLACK, 52, button_width - 70)
    draw.text(
        (center_x, button_y0 + button_height // 2 - 1),
        cta,
        font=cta_font,
        fill=violet,
        anchor="mm",
    )

    PNG_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(PNG_OUTPUT, format="PNG", optimize=True)
    image.save(WEBP_OUTPUT, format="WEBP", quality=94, method=6)


if __name__ == "__main__":
    render()
