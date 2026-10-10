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

def draw_keyframe_mark(d, size, pad_ratio, accent=ACCENT, tri_color=WHITE):
    """Keyframe brackets + play triangle, centred in a size×size box."""
    s = size
    inset = s * pad_ratio
    box = [inset, inset, s - inset, s - inset]
    bw = max(2, int(s * 0.055))          # bracket stroke width
    bl = (box[2] - box[0]) * 0.30        # bracket arm length
    x0, y0, x1, y1 = box
    r = s * 0.045

    def arm(pts):
        d.line(pts, fill=accent, width=bw, joint='curve')
        for p in pts:
            d.ellipse([p[0]-bw/2, p[1]-bw/2, p[0]+bw/2, p[1]+bw/2], fill=accent)

    # top-left
    arm([(x0, y0 + r + bl), (x0, y0 + r), (x0 + r, y0), (x0 + r + bl, y0)])
    # top-right
    arm([(x1 - r - bl, y0), (x1 - r, y0), (x1, y0 + r), (x1, y0 + r + bl)])
    # bottom-left
    arm([(x0, y1 - r - bl), (x0, y1 - r), (x0 + r, y1), (x0 + r + bl, y1)])
    # bottom-right
    arm([(x1 - r - bl, y1), (x1 - r, y1), (x1, y1 - r), (x1, y1 - r - bl)])

    # play triangle
    cx, cy = s * 0.5, s * 0.5
    tw = (box[2] - box[0]) * 0.30
    th = tw * 1.16
    off = tw * 0.10
    tri = [(cx - tw/2 + off, cy - th/2), (cx + tw/2 + off, cy), (cx - tw/2 + off, cy + th/2)]
    d.polygon(tri, fill=tri_color)

def make_icon(size, maskable=False, radius_ratio=0.22):
    ss = 4
    big = size * ss
    base = Image.new('RGB', (big, big), BG)
    base = radial_glow(base, big * 0.5, big * 0.44, big * 0.66, ACCENT, 105)
    d = ImageDraw.Draw(base)
    # subtle inner surface frame
    pad = big * (0.14 if maskable else 0.0)
    d.rounded_rectangle(
        [big*0.06, big*0.06, big*0.94, big*0.94],
        radius=big*0.18, outline=lerp(SURF, ACCENT, 0.25), width=max(2, int(big*0.004))
    )
    draw_keyframe_mark(d, big, 0.30 if maskable else 0.235, ACCENT_LIGHT)
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
