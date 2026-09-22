"""Generate app icon / adaptive icon / splash / favicon for breakawayroping.

Produces clean, brand-consistent assets (dark #140b1c background, warm rope
accent) with a lasso-loop motif and a "BR" monogram. Run: python3 scripts/gen_assets.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)

BG = (20, 11, 28, 255)        # #140b1c
ROPE = (214, 168, 108, 255)   # warm tan rope
ROPE_HI = (240, 205, 150, 255)
WHITE = (245, 240, 250, 255)


def _font(size):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def draw_mark(d, cx, cy, scale, with_monogram=True):
    """Lasso loop (ellipse) + trailing rope + optional BR monogram."""
    # Loop ring
    rw, rh = int(360 * scale), int(300 * scale)
    lw = max(6, int(34 * scale))
    box = [cx - rw, cy - rh, cx + rw, cy + rh]
    d.ellipse(box, outline=ROPE, width=lw)
    d.ellipse([box[0] + lw, box[1] + lw, box[2] - lw, box[3] - lw],
              outline=ROPE_HI, width=max(2, int(8 * scale)))
    # Trailing rope from bottom of loop, curving down-right
    pts = []
    steps = 40
    for i in range(steps + 1):
        t = i / steps
        x = cx - int(40 * scale) + int(t * 420 * scale)
        y = cy + rh - int(10 * scale) + int((t ** 1.6) * 520 * scale)
        pts.append((x, y))
    d.line(pts, fill=ROPE, width=lw, joint="curve")
    if with_monogram:
        f = _font(int(300 * scale))
        txt = "BR"
        bb = d.textbbox((0, 0), txt, font=f)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        d.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), txt, font=f, fill=WHITE)


def make_icon(path, size=1024, bg=True, monogram=True):
    img = Image.new("RGBA", (size, size), BG if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        # subtle rounded vignette corners already square for stores
        pass
    draw_mark(d, size // 2, int(size * 0.46), size / 1024.0, with_monogram=monogram)
    img.save(path)
    print("wrote", path, img.size)


def make_splash(path, w=1284, h=2778):
    img = Image.new("RGBA", (w, h), BG)
    d = ImageDraw.Draw(img)
    draw_mark(d, w // 2, int(h * 0.42), (w / 1024.0) * 0.9, with_monogram=True)
    f = _font(int(w * 0.075))
    txt = "Breakaway Roping"
    bb = d.textbbox((0, 0), txt, font=f)
    tw = bb[2] - bb[0]
    d.text(((w - tw) / 2 - bb[0], int(h * 0.66)), txt, font=f, fill=WHITE)
    img.save(path)
    print("wrote", path, img.size)


if __name__ == "__main__":
    make_icon(os.path.join(OUT, "icon.png"), 1024, bg=True, monogram=True)
    # Adaptive foreground: transparent bg, mark centered smaller (safe zone)
    make_icon(os.path.join(OUT, "adaptive-icon.png"), 1024, bg=False, monogram=True)
    make_splash(os.path.join(OUT, "splash.png"))
    make_icon(os.path.join(OUT, "favicon.png"), 48, bg=True, monogram=True)
