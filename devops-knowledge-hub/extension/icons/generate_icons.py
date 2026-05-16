"""
Run once to generate PNG icons for the Chrome extension.
Requires: pip install Pillow
"""
import os
from PIL import Image, ImageDraw, ImageFont

SIZES = [16, 48, 128]
BG_COLOR = (10, 102, 194)   # LinkedIn blue
FG_COLOR = (255, 255, 255)

script_dir = os.path.dirname(__file__)

for size in SIZES:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded-rect background
    radius = size // 5
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG_COLOR)

    # Simple document icon: white rectangle with folded corner
    pad = size // 6
    doc_w = int(size * 0.5)
    doc_h = int(size * 0.65)
    x0 = (size - doc_w) // 2
    y0 = (size - doc_h) // 2
    x1 = x0 + doc_w
    y1 = y0 + doc_h
    fold = doc_w // 3

    # Draw document body
    draw.polygon(
        [
            (x0, y0 + fold),
            (x0 + fold, y0),
            (x1, y0),
            (x1, y1),
            (x0, y1),
        ],
        fill=FG_COLOR,
    )
    # Folded corner
    draw.polygon(
        [(x0, y0 + fold), (x0 + fold, y0), (x0 + fold, y0 + fold)],
        fill=(180, 210, 240),
    )

    # Lines suggesting text (only at 48+ px)
    if size >= 48:
        line_color = (180, 210, 240)
        lx0 = x0 + size // 10
        lx1 = x1 - size // 10
        for i in range(3):
            ly = y0 + fold + (size // 10) * (i + 1) + size // 20
            if ly + 2 < y1 - size // 15:
                draw.rectangle([lx0, ly, lx1, ly + max(1, size // 30)], fill=line_color)

    out = os.path.join(script_dir, f"icon{size}.png")
    img.save(out)
    print(f"Written {out}")
