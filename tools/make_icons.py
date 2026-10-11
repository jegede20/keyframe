"""Generate the Keyframe icon set, maskable icon, shortcuts, and OG image."""
from PIL import Image, ImageDraw, ImageFont
import math, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(ROOT, exist_ok=True)

BG = (10, 10, 15)
SURF = (18, 18, 26)
ACCENT = (108, 92, 231)
ACCENT_LIGHT = (123, 111, 240)
GREEN = (0, 229, 160)
WHITE = (240, 240, 245)

def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def radial_glow(img, cx, cy, radius, color, alpha=90):
    """Additive radial glow."""
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    steps = 60
    for i in range(steps, 0, -1):
        t = i / steps
        r = radius * t
        a = int(alpha * (1 - t) ** 1.7)
        if a <= 0:
            continue
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (a,))
    return Image.alpha_composite(img.convert('RGBA'), glow)

def rounded_mask(size, radius, scale=4):
    w = size * scale
    m = Image.new('L', (w, w), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, w - 1, w - 1], radius=radius * scale, fill=255)
    return m.resize((size, size), Image.LANCZOS)

def draw_keyframe_mark(d, size_or_box, pad_ratio=0.0, accent=ACCENT, diamond_color=WHITE, scale=1.0):
    """Keyframe mark: a diamond pinned to a timeline track.

    Mirrors src/components/shared/Logo.jsx and tools/shot_templates.py — a
    keyframe diamond (white) on a dim accent track with accent end markers.

    size_or_box: tile size (int) or (x0, y0, x1, y1) box.
    scale: shrinks the whole mark around the box centre (for maskable safe zones).
    """
    if isinstance(size_or_box, (tuple, list)):
        x0, y0, x1, y1 = [float(v) for v in size_or_box]
    else:
        inset = size_or_box * pad_ratio
        x0, y0, x1, y1 = inset, inset, size_or_box - inset, size_or_box - inset

    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w = (x1 - x0) * scale
    h = (y1 - y0) * scale

    track_w = max(2, int(min(w, h) * 0.075))
    dot_r = min(w, h) * 0.068
    half = min(w, h) * 0.225 * 2  # diamond half-diagonal (matches the 32-unit SVG)

    # track — dim accent, ends short of the markers
    d.line(
        [(cx - w * 0.40 + dot_r * 0.6, cy), (cx + w * 0.40 - dot_r * 0.6, cy)],
        fill=lerp(BG, accent, 0.5),
        width=track_w,
    )
    # end markers
    for px in (cx - w * 0.42, cx + w * 0.42):
        d.ellipse([px - dot_r, cy - dot_r, px + dot_r, cy + dot_r], fill=lerp(accent, WHITE, 0.2))
    # the keyframe diamond
    d.polygon(
        [(cx, cy - half), (cx + half, cy), (cx, cy + half), (cx - half, cy)],
        fill=diamond_color,
    )

def make_icon(size, maskable=False, radius_ratio=0.22):
    ss = 4
    big = size * ss
    base = Image.new('RGB', (big, big), BG)
    base = radial_glow(base, big * 0.5, big * 0.44, big * 0.66, ACCENT, 105)
    d = ImageDraw.Draw(base)
    # subtle inner surface frame
    d.rounded_rectangle(
        [big*0.06, big*0.06, big*0.94, big*0.94],
        radius=big*0.18, outline=lerp(SURF, ACCENT, 0.25), width=max(2, int(big*0.004))
    )
    draw_keyframe_mark(d, (0, 0, big, big), scale=0.54 if maskable else 0.66)
    img = base.resize((size, size), Image.LANCZOS)
    if maskable:
        return img  # full-bleed art; platform applies the mask itself
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), rounded_mask(size, int(size * radius_ratio)))
    return out

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
for s in SIZES:
    ic = make_icon(s)
    ic.save(os.path.join(ROOT, f'icon-{s}x{s}.png'))

make_icon(512, maskable=True).save(os.path.join(ROOT, 'icon-maskable-512x512.png'))

# ── Shortcut icons ────────────────────────────────────────────────────────────
def shortcut(size, kind):
    ss = 4
    big = size * ss
    base = Image.new('RGB', (big, big), BG)
    base = radial_glow(base, big*0.5, big*0.5, big*0.7, ACCENT, 80)
    d = ImageDraw.Draw(base)
    cx = cy = big/2
    lw = max(2, int(big*0.055))
    if kind == 'new':  # plus
        e = big * 0.17
        d.line([cx-e, cy, cx+e, cy], fill=ACCENT_LIGHT, width=lw)
        d.line([cx, cy-e, cx, cy+e], fill=ACCENT_LIGHT, width=lw)
    else:              # history clock
        rr = big * 0.21
        d.ellipse([cx-rr, cy-rr, cx+rr, cy+rr], outline=ACCENT_LIGHT, width=lw)
        d.line([cx, cy - rr*0.55, cx, cy], fill=ACCENT_LIGHT, width=lw)
        d.line([cx, cy, cx + rr*0.45, cy + rr*0.30], fill=ACCENT_LIGHT, width=lw)
    img = base.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0,0,0,0))
    out.paste(img, (0,0), rounded_mask(size, int(size*0.22)))
    return out

shortcut(96, 'new').save(os.path.join(ROOT, 'shortcut-new.png'))
shortcut(96, 'history').save(os.path.join(ROOT, 'shortcut-history.png'))

print('icons written:', sorted(os.listdir(ROOT)))
