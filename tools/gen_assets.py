#!/usr/bin/env python3
"""Generate the raster brand assets from the same design as assets/icon.svg.

    python tools/gen_assets.py

Outputs:
    assets/logo.png            512x512 transparent-corner app logo
    assets/icon.ico            multi-size Windows icon
    assets/social-preview.png  1280x640 GitHub social preview

Requires Pillow. The vector source of truth is assets/icon.svg; keep the two in
sync when changing the mark.
"""

from pathlib import Path
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"

BG_TOP = (43, 50, 66)
BG_BOTTOM = (22, 26, 34)
PILL = (37, 43, 56)
PILL_BORDER = (255, 255, 255, 36)
ACCENT = (255, 154, 31)
TEXT = (242, 242, 245)
MUTED = (167, 173, 184)


def font(size, bold=False):
    windir = Path(os.environ.get("WINDIR", r"C:\Windows"))
    candidates = [
        windir / "Fonts" / ("segoeuib.ttf" if bold else "segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
             "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def vertical_gradient(width, height, top, bottom):
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (width, y)], fill=color)
    return image


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255
    )
    return mask


def draw_logo(size=1024):
    scale = size / 1024
    image = vertical_gradient(size, size, BG_TOP, BG_BOTTOM).convert("RGBA")
    image.putalpha(rounded_mask((size, size), round(224 * scale)))

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    draw.arc(
        [round(112 * scale), round(112 * scale), round(912 * scale), round(912 * scale)],
        start=200,
        end=340,
        fill=(*ACCENT, 60),
        width=max(2, round(16 * scale)),
    )

    pill = [
        round(150 * scale),
        round(370 * scale),
        round(874 * scale),
        round(654 * scale),
    ]
    draw.rounded_rectangle(
        pill,
        radius=round(142 * scale),
        fill=(*PILL, 255),
        outline=PILL_BORDER,
        width=max(2, round(4 * scale)),
    )

    dot_x = round(250 * scale)
    dot_y = round(512 * scale)
    dot_r = round(36 * scale)
    draw.ellipse(
        [dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r],
        fill=(*ACCENT, 255),
    )

    big = font(max(12, round(144 * scale)), bold=True)
    small = font(max(10, round(96 * scale)), bold=False)
    x = round(330 * scale)
    draw.text((x, dot_y), "42", font=big, fill=TEXT, anchor="lm")
    x += big.getlength("42") + round(24 * scale)
    draw.text((x, dot_y + round(4 * scale)), "tok/s", font=small, fill=MUTED, anchor="lm")

    return Image.alpha_composite(image, overlay)


def draw_social_preview(width=1280, height=640):
    image = vertical_gradient(width, height, (43, 50, 66), (22, 26, 34)).convert("RGBA")
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    draw.ellipse([760, -180, 1380, 440], fill=(255, 194, 74, 22))
    draw.ellipse([980, 320, 1460, 800], fill=(255, 122, 0, 16))

    logo = draw_logo(1024).resize((300, 300), Image.LANCZOS)
    image.alpha_composite(logo, (80, 170))

    title = font(64, bold=True)
    subtitle = font(28)
    small = font(20)
    pill_big = font(54, bold=True)
    pill_small = font(30)

    x = 440
    draw.text((x, 236), "ZCode Tok/s Badge", font=title, fill=TEXT, anchor="lm")
    draw.text(
        (x, 312),
        "A capsule tok/s badge for the ZCode desktop app.",
        font=subtitle,
        fill=MUTED,
        anchor="lm",
    )

    pill = [x, 370, x + 420, 470]
    draw.rounded_rectangle(pill, radius=50, fill=(*PILL, 255), outline=PILL_BORDER, width=3)
    draw.ellipse([x + 36, 402, x + 72, 438], fill=(*ACCENT, 255))
    draw.text((x + 96, 420), "42.1", font=pill_big, fill=TEXT, anchor="lm")
    draw.text((x + 230, 424), "tok/s", font=pill_small, fill=MUTED, anchor="lm")

    draw.text(
        (x, 548),
        "github.com/MVennn/ZCodeTpsBadge",
        font=small,
        fill=(140, 140, 152),
        anchor="lm",
    )

    return Image.alpha_composite(image, overlay)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)

    logo = draw_logo(1024).resize((512, 512), Image.LANCZOS)
    logo.save(ASSETS / "logo.png", "PNG", optimize=True)
    logo.save(
        ASSETS / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    social = draw_social_preview()
    social.convert("RGB").save(ASSETS / "social-preview.png", "PNG", optimize=True)

    print("wrote assets/logo.png, assets/icon.ico, assets/social-preview.png")


if __name__ == "__main__":
    main()
