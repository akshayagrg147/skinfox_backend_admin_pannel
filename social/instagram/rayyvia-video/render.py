#!/usr/bin/env python3
"""Render an original SkinFox Rayyvia Instagram Reel from approved local assets."""

from __future__ import annotations

import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUTPUT = ROOT / "output"
OUTPUT.mkdir(parents=True, exist_ok=True)

WIDTH, HEIGHT = 1080, 1920
FPS = 30
DURATION = 19.0
TOTAL_FRAMES = int(DURATION * FPS)

COLORS = {
    "ink": "#2E153F",
    "purple": "#663382",
    "pink": "#EE8BB5",
    "blush": "#F8E4ED",
    "yellow": "#FFD93F",
    "cream": "#FFF9F1",
    "white": "#FFFFFF",
    "coral": "#FF817A",
}

FONT_HEAD = "/System/Library/Fonts/Supplemental/Futura.ttc"
FONT_BODY = "/System/Library/Fonts/Avenir Next.ttc"
FONT_CONDENSED = "/System/Library/Fonts/Avenir Next Condensed.ttc"


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size, index=index)


F_HUGE = font(FONT_HEAD, 134)
F_LARGE = font(FONT_HEAD, 94)
F_MED = font(FONT_HEAD, 65)
F_SMALL = font(FONT_BODY, 32)
F_MICRO = font(FONT_BODY, 24)
F_HANDLE = font(FONT_CONDENSED, 40)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return 1 - (1 - value) ** 3


def smooth(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def gradient(top: str, bottom: str) -> Image.Image:
    a = np.array(hex_rgb(top), dtype=np.float32)
    b = np.array(hex_rgb(bottom), dtype=np.float32)
    y = np.linspace(0, 1, HEIGHT, dtype=np.float32)[:, None, None]
    arr = a[None, None, :] * (1 - y) + b[None, None, :] * y
    arr = np.repeat(arr, WIDTH, axis=1).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


BG_CREAM = gradient(COLORS["cream"], COLORS["blush"])
BG_PINK = gradient("#FFF8F4", "#F8D3E3")
BG_YELLOW = gradient("#FFFDF5", "#FFE99A")
BG_PURPLE = gradient("#7C4A9B", "#3A194E")


def cover(image: Image.Image, size: tuple[int, int], center=(0.5, 0.5), zoom=1.0) -> Image.Image:
    target_w, target_h = size
    src_w, src_h = image.size
    scale = max(target_w / src_w, target_h / src_h) * zoom
    resized = image.resize((max(1, int(src_w * scale)), max(1, int(src_h * scale))), Image.Resampling.LANCZOS)
    max_x = max(0, resized.width - target_w)
    max_y = max(0, resized.height - target_h)
    left = int(max_x * clamp(center[0]))
    top = int(max_y * clamp(center[1]))
    return resized.crop((left, top, left + target_w, top + target_h))


def rounded_paste(canvas: Image.Image, image: Image.Image, box: tuple[int, int, int, int], radius=42, shadow=True) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    fitted = cover(image, (w, h))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    if shadow:
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        sm = Image.new("L", (w, h), 0)
        ImageDraw.Draw(sm).rounded_rectangle((0, 0, w, h), radius=radius, fill=90)
        sm = sm.filter(ImageFilter.GaussianBlur(24))
        layer.paste((50, 20, 60, 80), (x0, y0 + 16), sm)
        canvas.paste(layer, (0, 0), layer)
    canvas.paste(fitted, (x0, y0), mask)


def paste_crop(
    canvas: Image.Image,
    image: Image.Image,
    box: tuple[int, int, int, int],
    center=(0.5, 0.5),
    zoom=1.0,
    radius=0,
) -> None:
    x0, y0, x1, y1 = box
    fitted = cover(image, (x1 - x0, y1 - y0), center=center, zoom=zoom)
    if radius:
        mask = Image.new("L", fitted.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, fitted.width, fitted.height), radius=radius, fill=255)
        canvas.paste(fitted, (x0, y0), mask)
    else:
        canvas.paste(fitted, (x0, y0))


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, face, fill: str, spacing=8, anchor="la", align="left", stroke=0) -> None:
    draw.multiline_text(xy, value, font=face, fill=fill, spacing=spacing, anchor=anchor, align=align, stroke_width=stroke, stroke_fill=fill)


def tracked(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, face, fill: str, tracking=7) -> None:
    x, y = xy
    for char in value:
        draw.text((x, y), char, font=face, fill=fill)
        box = draw.textbbox((x, y), char, font=face)
        x += box[2] - box[0] + tracking


def moving_shapes(canvas: Image.Image, t: float, variant=0) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    dx = int(20 * math.sin(t * 1.2 + variant))
    dy = int(18 * math.cos(t * 0.9 + variant))
    d.ellipse((-160 + dx, 1210 + dy, 360 + dx, 1730 + dy), fill=(255, 217, 63, 90))
    d.ellipse((810 - dx, 70 - dy, 1230 - dx, 490 - dy), fill=(238, 139, 181, 75))
    d.rounded_rectangle((720 + dx, 1460 - dy, 1180 + dx, 1740 - dy), radius=90, fill=(102, 51, 130, 35))
    layer = layer.filter(ImageFilter.GaussianBlur(4))
    canvas.paste(layer, (0, 0), layer)


images = {
    "hero": Image.open(ASSETS / "rayyvia-product-hero.png").convert("RGB"),
    "model": Image.open(ASSETS / "rayyvia-model-portrait.png").convert("RGB"),
    "application": Image.open(ASSETS / "rayyvia-application.png").convert("RGB"),
    "texture": Image.open(ASSETS / "rayyvia-ingredient-texture.png").convert("RGB"),
    "mosaic": Image.open(ASSETS / "rayyvia-portrait-mosaic.png").convert("RGB"),
}


def scene_intro(local: float, length: float) -> Image.Image:
    p = ease(local / 0.5)
    canvas = BG_CREAM.copy()
    moving_shapes(canvas, local, 0)
    y_shift = int((1 - p) * 90)
    zoom = 1.03 + 0.035 * (local / length)
    crop = cover(images["hero"], (948, 820), center=(0.25, 0.5), zoom=zoom)
    rounded_paste(canvas, crop, (66, 150 + y_shift, 1014, 970 + y_shift), 54)
    d = ImageDraw.Draw(canvas)
    tracked(d, (72, 1085 + y_shift), "SKINFOX PRESENTS", F_MICRO, COLORS["purple"], 6)
    text(d, (66, 1195 + y_shift), "MEET\nRAYYVIA", F_HUGE, COLORS["ink"], spacing=-6)
    text(d, (72, 1530 + y_shift), "SUN PROTECT", F_MED, COLORS["pink"])
    d.rounded_rectangle((72, 1635 + y_shift, 430, 1694 + y_shift), 30, fill=COLORS["yellow"])
    text(d, (251, 1664 + y_shift), "DAILY GLOW · 60 g", F_MICRO, COLORS["ink"], anchor="mm")
    return canvas


def scene_format(local: float, length: float) -> Image.Image:
    p = ease(local / 0.38)
    canvas = BG_YELLOW.copy()
    moving_shapes(canvas, local, 1)
    zoom = 1.08 + 0.06 * (local / length)
    paste_crop(canvas, images["hero"], (55, 120, 1025, 1115), center=(0.24, 0.52), zoom=zoom, radius=50)
    d = ImageDraw.Draw(canvas)
    y = int(1260 + (1 - p) * 55)
    text(d, (62, y), "60 g", F_HUGE, COLORS["purple"])
    text(d, (68, y + 170), "FACIAL SUNCREAM", F_MED, COLORS["ink"])
    tracked(d, (70, y + 285), "PACK FORMAT", F_MICRO, COLORS["purple"], 7)
    return canvas


def scene_model(local: float, length: float) -> Image.Image:
    p = ease(local / 0.42)
    canvas = BG_PINK.copy()
    moving_shapes(canvas, local, 2)
    panel_y = int(160 + (1 - p) * 65)
    whole = ImageOps.contain(images["model"], (980, 760), Image.Resampling.LANCZOS)
    panel = Image.new("RGB", (980, 760), COLORS["white"])
    panel.paste(whole, ((980 - whole.width) // 2, (760 - whole.height) // 2))
    rounded_paste(canvas, panel, (50, panel_y, 1030, panel_y + 760), 54)
    d = ImageDraw.Draw(canvas)
    text(d, (66, 1060), "DAILY CARE.", F_LARGE, COLORS["ink"])
    text(d, (66, 1180), "BRIGHT ENERGY.", F_LARGE, COLORS["pink"])
    d.line((70, 1395, int(70 + 860 * smooth(local / length)), 1395), fill=COLORS["purple"], width=10)
    text(d, (70, 1450), "ONE COLOURFUL SKINFOX RITUAL", F_SMALL, COLORS["purple"])
    return canvas


def scene_application(local: float, length: float) -> Image.Image:
    p = ease(local / 0.4)
    canvas = BG_CREAM.copy()
    paste_crop(canvas, images["application"], (0, 0, WIDTH, 1120), center=(0.5, 0.5), zoom=1.0 + 0.035 * local / length)
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((0, 930, WIDTH, HEIGHT), fill=(255, 249, 241, 242))
    overlay = overlay.filter(ImageFilter.GaussianBlur(1))
    canvas.paste(overlay, (0, 0), overlay)
    d = ImageDraw.Draw(canvas)
    y = int(1110 + (1 - p) * 70)
    text(d, (65, y), "MAKE IT\nA RITUAL", F_HUGE, COLORS["ink"], spacing=-8)
    d.rounded_rectangle((68, 1515, 602, 1580), 34, fill=COLORS["pink"])
    text(d, (335, 1548), "RAYYVIA SUN PROTECT", F_MICRO, COLORS["white"], anchor="mm")
    return canvas


def scene_almond(local: float, length: float) -> Image.Image:
    p = ease(local / 0.38)
    canvas = BG_YELLOW.copy()
    paste_crop(canvas, images["texture"], (50, 145, 1030, 1125), center=(0.66, 0.5), zoom=1.03 + 0.04 * local / length, radius=58)
    d = ImageDraw.Draw(canvas)
    y = int(1265 + (1 - p) * 60)
    text(d, (65, y), "ALMOND OIL", F_LARGE, COLORS["ink"])
    tracked(d, (70, y + 160), "NAMED ON PACK", F_SMALL, COLORS["purple"], 7)
    d.ellipse((820, 1330, 970, 1480), fill=COLORS["pink"])
    d.ellipse((865, 1375, 925, 1435), fill=COLORS["yellow"])
    return canvas


def scene_minerals(local: float, length: float) -> Image.Image:
    p = ease(local / 0.45)
    canvas = BG_PINK.copy()
    paste_crop(canvas, images["texture"], (40, 105, 1040, 1045), center=(0.57, 0.45), zoom=1.05 + 0.04 * local / length, radius=58)
    d = ImageDraw.Draw(canvas)
    y = int(1160 + (1 - p) * 70)
    text(d, (60, y), "ZINC OXIDE +", F_MED, COLORS["purple"])
    text(d, (60, y + 100), "TITANIUM DIOXIDE", F_MED, COLORS["ink"])
    tracked(d, (65, y + 245), "NAMED ON PACK", F_SMALL, COLORS["purple"], 7)
    d.line((65, y + 330, int(65 + 875 * smooth(local / length)), y + 330), fill=COLORS["yellow"], width=14)
    return canvas


def scene_montage(local: float, length: float) -> Image.Image:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), COLORS["cream"])
    p = ease(local / 0.35)
    gap = 18
    margin = 38
    top = int(90 + (1 - p) * 65)
    w = (WIDTH - margin * 2 - gap) // 2
    h = 560
    paste_crop(canvas, images["model"], (margin, top, margin + w, top + h), center=(0.72, 0.5), zoom=1.08, radius=34)
    paste_crop(canvas, images["application"], (margin + w + gap, top, WIDTH - margin, top + h), center=(0.28, 0.48), zoom=1.08, radius=34)
    paste_crop(canvas, images["texture"], (margin, top + h + gap, WIDTH - margin, top + h + gap + 535), center=(0.60, 0.52), zoom=1.02, radius=34)
    d = ImageDraw.Draw(canvas)
    text(d, (54, 1300), "ONE BRIGHT\nROUTINE.", F_HUGE, COLORS["ink"], spacing=-8)
    tracked(d, (60, 1630), "SKINFOX · DAILY CARE", F_SMALL, COLORS["pink"], 6)
    return canvas


def scene_faces(local: float, length: float) -> Image.Image:
    p = ease(local / 0.35)
    canvas = BG_CREAM.copy()
    panel_y = int(300 + (1 - p) * 70)
    mosaic = ImageOps.fit(images["mosaic"], (1020, 620), Image.Resampling.LANCZOS)
    rounded_paste(canvas, mosaic, (30, panel_y, 1050, panel_y + 620), 40, shadow=False)
    # The source mosaic intentionally leaves a white centre column; fill it with a clean product crop.
    product = cover(images["hero"], (245, 520), center=(0.24, 0.52), zoom=1.3)
    product = ImageEnhance.Contrast(product).enhance(1.02)
    rounded_paste(canvas, product, (418, panel_y + 48, 663, panel_y + 568), 22, shadow=False)
    d = ImageDraw.Draw(canvas)
    text(d, (54, 1080), "CARE HAS\nMANY FACES.", F_HUGE, COLORS["ink"], spacing=-8)
    tracked(d, (60, 1410), "SHOW UP FOR YOUR ROUTINE", F_SMALL, COLORS["purple"], 6)
    return canvas


def scene_end(local: float, length: float) -> Image.Image:
    p = ease(local / 0.55)
    canvas = BG_PURPLE.copy()
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    r = int(420 + 18 * math.sin(local * 2))
    ld.ellipse((WIDTH - r - 120, 80, WIDTH + r - 120, 80 + 2 * r), fill=(255, 217, 63, 52))
    ld.ellipse((-250, 1330, 410, 1990), fill=(238, 139, 181, 55))
    canvas.paste(layer, (0, 0), layer)
    y = int(95 + (1 - p) * 90)
    paste_crop(canvas, images["hero"], (60, y, 1020, y + 860), center=(0.27, 0.5), zoom=1.04, radius=58)
    d = ImageDraw.Draw(canvas)
    text(d, (60, 1110), "RAYYVIA", F_HUGE, COLORS["white"])
    text(d, (65, 1280), "SUN PROTECT", F_MED, COLORS["yellow"])
    text(d, (65, 1410), "BY SKINFOX", F_SMALL, COLORS["white"])
    d.rounded_rectangle((60, 1515, 690, 1600), 42, fill=COLORS["pink"])
    text(d, (375, 1557), "@SKINFOX_OFFICIAL", F_HANDLE, COLORS["white"], anchor="mm")
    text(d, (62, 1662), "Check final pack for complete details.", F_MICRO, "#EEDFF4")
    return canvas


SCENES = [
    (0.0, 1.6, scene_intro),
    (1.6, 3.1, scene_format),
    (3.1, 5.4, scene_model),
    (5.4, 7.2, scene_application),
    (7.2, 9.2, scene_almond),
    (9.2, 11.3, scene_minerals),
    (11.3, 13.8, scene_montage),
    (13.8, 16.2, scene_faces),
    (16.2, 19.0, scene_end),
]


def add_flash(frame: Image.Image, local: float) -> Image.Image:
    if local >= 0.14:
        return frame
    alpha = int(150 * (1 - local / 0.14))
    flash = Image.new("RGBA", frame.size, (255, 255, 255, alpha))
    out = frame.convert("RGBA")
    out.alpha_composite(flash)
    return out.convert("RGB")


def render_frame(t: float) -> Image.Image:
    for index, (start, end, renderer) in enumerate(SCENES):
        if t < end or index == len(SCENES) - 1:
            local = max(0.0, t - start)
            frame = renderer(local, end - start)
            if index > 0:
                frame = add_flash(frame, local)
            return frame
    return scene_end(DURATION, DURATION)


def synth_audio(path: Path) -> None:
    sr = 48_000
    n = int(DURATION * sr)
    mix = np.zeros(n, dtype=np.float64)
    rng = np.random.default_rng(20260904)
    beat = 60 / 126

    # Airy harmonic bed.
    time = np.arange(n) / sr
    chord = (np.sin(2 * np.pi * 220 * time) + 0.65 * np.sin(2 * np.pi * 277.18 * time) + 0.5 * np.sin(2 * np.pi * 329.63 * time))
    mix += 0.025 * chord * (0.76 + 0.24 * np.sin(2 * np.pi * 0.25 * time))

    def add(start: float, sound: np.ndarray) -> None:
        pos = int(start * sr)
        if pos >= n:
            return
        end = min(n, pos + len(sound))
        mix[pos:end] += sound[: end - pos]

    beats = int(math.ceil(DURATION / beat))
    for i in range(beats):
        at = i * beat
        # Rounded electronic kick.
        kt = np.arange(int(0.24 * sr)) / sr
        phase = 2 * np.pi * (92 * kt - 58 * kt * kt)
        kick = 0.36 * np.sin(phase) * np.exp(-17 * kt)
        add(at, kick)
        # Soft clap on beats two and four.
        if i % 4 in (1, 3):
            ct = np.arange(int(0.16 * sr)) / sr
            noise = rng.standard_normal(len(ct))
            high = np.concatenate(([0], np.diff(noise)))
            clap = 0.075 * high * np.exp(-25 * ct)
            add(at, clap)
        # Bright eighth-note hats.
        for offset in (0.0, beat / 2):
            ht = np.arange(int(0.045 * sr)) / sr
            noise = rng.standard_normal(len(ht))
            high = np.concatenate(([0], np.diff(noise)))
            hat = 0.025 * high * np.exp(-70 * ht)
            add(at + offset, hat)

    # Short musical plucks and transition whooshes.
    notes = [523.25, 659.25, 783.99, 659.25]
    for i in range(0, beats, 2):
        pt = np.arange(int(0.32 * sr)) / sr
        pluck = 0.05 * np.sin(2 * np.pi * notes[(i // 2) % 4] * pt) * np.exp(-11 * pt)
        add(i * beat, pluck)
    for at in [1.6, 3.1, 5.4, 7.2, 9.2, 11.3, 13.8, 16.2]:
        wt = np.arange(int(0.22 * sr)) / sr
        noise = rng.standard_normal(len(wt))
        envelope = np.sin(np.pi * np.clip(wt / 0.22, 0, 1)) ** 2
        whoosh = 0.024 * np.cumsum(noise) / np.sqrt(np.arange(1, len(noise) + 1)) * envelope
        add(at - 0.10, whoosh)

    # Gentle opening/closing fades and safe headroom.
    fade = int(0.35 * sr)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)
    peak = np.max(np.abs(mix))
    if peak:
        mix *= 0.86 / peak
    stereo = np.stack((mix, mix), axis=1)
    pcm = np.int16(np.clip(stereo, -1, 1) * 32767)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        wav.writeframes(pcm.tobytes())


def render() -> Path:
    silent = OUTPUT / "rayyvia-sun-protect-reel-silent-v1.mp4"
    audio = OUTPUT / "rayyvia-original-beat-v1.wav"
    final = OUTPUT / "rayyvia-sun-protect-reel-v2.mp4"

    synth_audio(audio)
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-profile:v", "high", "-level", "4.1", "-g", "60", "-movflags", "+faststart", str(silent),
    ]
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert process.stdin is not None
    for index in range(TOTAL_FRAMES):
        frame = render_frame(index / FPS)
        process.stdin.write(np.asarray(frame, dtype=np.uint8).tobytes())
        if index % 30 == 0:
            print(f"rendered {index}/{TOTAL_FRAMES}", flush=True)
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg video encode failed")

    mux = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(silent), "-i", str(audio), "-t", str(DURATION),
        "-c:v", "copy", "-af", "loudnorm=I=-15.5:TP=-1.5:LRA=3",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", str(final),
    ]
    subprocess.run(mux, check=True)
    print(final, flush=True)
    return final


if __name__ == "__main__":
    try:
        render()
    except BrokenPipeError:
        print("Video encoder closed unexpectedly", file=sys.stderr)
        raise
