"""Draw the Command Deck app icons in the deck's HUD style.

Run: python3 tools/make_icons.py   (needs Pillow)
Writes icons/apple-touch-icon.png (180), icon-192.png, icon-512.png and
icon-maskable-512.png (artwork inside the 80% safe zone).
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

VOID = (3, 8, 14)
HOLO = (79, 216, 255)
AMBER = (255, 181, 71)
OUT = Path(__file__).resolve().parent.parent / "icons"
SS = 4  # supersampling factor


def diamond(cx, cy, r):
    return [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]


def draw(size, art=1.0):
    S = size * SS
    img = Image.new("RGB", (S, S), VOID)

    # faint blueprint grid + top glow
    glow = Image.new("RGB", (S, S), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([S * 0.05, -S * 0.45, S * 0.95, S * 0.55], fill=(14, 52, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.12))
    img = Image.blend(img, glow, 0.55)
    d = ImageDraw.Draw(img)
    step = S / 8
    for i in range(1, 8):
        p = round(i * step)
        d.line([(p, 0), (p, S)], fill=(10, 30, 42), width=max(1, SS))
        d.line([(0, p), (S, p)], fill=(10, 30, 42), width=max(1, SS))

    c = S / 2
    R = S * 0.36 * art

    # bloom layer for the mark
    bloom = Image.new("RGB", (S, S), (0, 0, 0))
    bd = ImageDraw.Draw(bloom)
    bd.polygon(diamond(c, c, R), outline=HOLO, width=round(S * 0.035 * art))
    bd.polygon(diamond(c, c, R * 0.42), fill=HOLO)
    bloom = bloom.filter(ImageFilter.GaussianBlur(S * 0.03))
    img = ImageChops.add(img, Image.eval(bloom, lambda v: int(v * 0.7)))

    d = ImageDraw.Draw(img)
    # outer rotated square (the spinning brand-mark ring)
    d.polygon(diamond(c, c, R), outline=HOLO, width=round(S * 0.03 * art))
    # corner brackets, like the deck's panels
    b = R * 0.28
    w = round(S * 0.022 * art)
    tl = (c - R * 1.12, c - R * 1.12)
    br = (c + R * 1.12, c + R * 1.12)
    d.line([tl, (tl[0] + b, tl[1])], fill=HOLO, width=w)
    d.line([tl, (tl[0], tl[1] + b)], fill=HOLO, width=w)
    d.line([br, (br[0] - b, br[1])], fill=HOLO, width=w)
    d.line([br, (br[0], br[1] - b)], fill=HOLO, width=w)
    # amber tick, like the core's amber arc
    d.line([(c + R * 0.62, c - R * 0.38), (c + R * 0.38, c - R * 0.62)], fill=AMBER, width=round(S * 0.03 * art))
    # solid core
    d.polygon(diamond(c, c, R * 0.42), fill=(139, 231, 255))
    d.polygon(diamond(c, c, R * 0.42), outline=HOLO, width=round(S * 0.01 * art))

    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    draw(180).save(OUT / "apple-touch-icon.png", optimize=True)
    draw(192).save(OUT / "icon-192.png", optimize=True)
    draw(512).save(OUT / "icon-512.png", optimize=True)
    draw(512, art=0.78).save(OUT / "icon-maskable-512.png", optimize=True)
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
