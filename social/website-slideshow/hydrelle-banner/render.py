from pathlib import Path
from typing import Optional, Tuple

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).with_name("hydrelle-lifestyle-base.png")
PNG_OUTPUT = ROOT / "public/products/hydrelle-slideshow-v1.png"
WEBP_OUTPUT = ROOT / "public/products/hydrelle-slideshow-v1.webp"

CANVAS_SIZE = (2880, 960)
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BOLD_ITALIC = "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf"


def fit_font(text: str, path: str, max_size: int, max_width: int) -> ImageFont.FreeTypeFont:
    size = max_size
    while size > 24:
        font = ImageFont.truetype(path, size)
        left, _, right, _ = font.getbbox(text)
        if right - left <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(path, size)


def centered_text(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: Tuple[int, int, int],
    shadow: Tuple[int, int, int],
    shadow_offset: Tuple[int, int],
    stroke_width: int = 0,
    stroke_fill: Optional[Tuple[int, int, int]] = None,
) -> None:
    sx, sy = shadow_offset
    draw.text(
        (x + sx, y + sy),
        text,
        font=font,
        fill=shadow,
        anchor="mm",
        stroke_width=stroke_width,
        stroke_fill=shadow if stroke_width else None,
    )
    draw.text(
        (x, y),
        text,
        font=font,
        fill=fill,
        anchor="mm",
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )


def add_badge(image: Image.Image, center_x: int, top_y: int) -> None:
    badge = Image.new("RGBA", (720, 160), (0, 0, 0, 0))
    badge_draw = ImageDraw.Draw(badge)
    badge_draw.rounded_rectangle((12, 18, 708, 142), radius=34, fill=(32, 124, 220, 255))

    copy = "DRY-SKIN CARE"
    font = fit_font(copy, FONT_BOLD_ITALIC, 70, 620)
    badge_draw.text((360, 79), copy, font=font, fill=(255, 255, 255), anchor="mm")

    rotated = badge.rotate(2, resample=Image.Resampling.BICUBIC, expand=True)
    left = center_x - rotated.width // 2
    image.paste(rotated, (left, top_y), rotated)


def render() -> None:
    image = Image.open(SOURCE).convert("RGB").resize(CANVAS_SIZE, Image.Resampling.LANCZOS)

    text_left = 1580
    text_right = 2810
    center_x = (text_left + text_right) // 2
    max_width = text_right - text_left

    add_badge(image, center_x + 55, 108)
    draw = ImageDraw.Draw(image)

    navy = (12, 51, 91)
    white = (255, 255, 255)
    cobalt = (31, 111, 203)
    violet = (102, 67, 165)

    headline = "MEET HYDRELLE"
    headline_font = fit_font(headline, FONT_BLACK, 140, max_width)
    centered_text(
        draw,
        center_x,
        365,
        headline,
        headline_font,
        white,
        cobalt,
        (7, 9),
        stroke_width=2,
        stroke_fill=white,
    )

    subline = "200 g moisturising lotion"
    subline_font = fit_font(subline, FONT_BOLD_ITALIC, 54, max_width - 120)
    centered_text(
        draw,
        center_x,
        497,
        subline,
        subline_font,
        navy,
        white,
        (2, 2),
    )

    button_width = 570
    button_height = 126
    button_x0 = center_x - button_width // 2
    button_y0 = 628
    button_box = (button_x0, button_y0, button_x0 + button_width, button_y0 + button_height)
    shadow_box = (button_x0 + 4, button_y0 + 10, button_x0 + button_width + 4, button_y0 + button_height + 10)

    draw.rounded_rectangle(shadow_box, radius=32, fill=(51, 111, 166))
    draw.rounded_rectangle(button_box, radius=32, fill=white, outline=navy, width=5)

    cta = "EXPLORE NOW  ›"
    cta_font = fit_font(cta, FONT_BLACK, 52, button_width - 72)
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
