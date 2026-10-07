#!/usr/bin/env python3
"""Make card covers fill their card.

For each raster cover in a Bases card, write a normalised thumbnail next to
the original (<name>.card.webp, 800x600, cropped to 4:3) and point the card at
it. The originals are not touched and still show on the notes themselves. The
thumbnails are a fraction of the size and carry no EXIF data (such as GPS).
SVG covers are left alone, since they are line icons that should not be cropped.

usage: card-covers.py public
"""
import os, re, sys
from PIL import Image, ImageOps

PUBLIC = sys.argv[1] if len(sys.argv) > 1 else "public"
W, H = 800, 600
# Where in the photo to keep when cropping: the middle, except portraits, which
# keep a little above the middle so heads and skylines stay in.
card = re.compile(
    r'(<div class="bases-card-image" style="--cover:url\(\')([^\']+)(\'\)"><img src=")([^"]+)(")([^>]*?)style="object-fit:(?:contain|cover);"')

made = {}
def thumb(page_dir, rel):
    src = os.path.normpath(os.path.join(page_dir, rel))
    if not os.path.isfile(src) or src.lower().endswith(".svg"):
        return None
    out = os.path.splitext(src)[0] + ".card.webp"
    if src not in made:
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        centre = (0.5, 0.35 if im.height > im.width else 0.5)
        ImageOps.fit(im, (W, H), Image.LANCZOS, centering=centre).save(out, "WEBP", quality=78, method=6)
        made[src] = (os.path.getsize(src), os.path.getsize(out))
    return os.path.relpath(out, page_dir)

pages = 0
for root, _, files in os.walk(PUBLIC):
    for f in files:
        if not f.endswith(".html"):
            continue
        path = os.path.join(root, f)
        text = open(path, encoding="utf-8").read()

        def fix(m):
            new = thumb(root, m.group(2))
            if not new:
                return m.group(0)
            new = new if new.startswith(".") else "./" + new
            return f'{m.group(1)}{new}{m.group(3)}{new}{m.group(5)}{m.group(6)}style="object-fit:cover;"'

        out = card.sub(fix, text)
        if out != text:
            open(path, "w", encoding="utf-8").write(out)
            pages += 1
before = sum(a for a, _ in made.values()); after = sum(b for _, b in made.values())
print(f"card covers: {len(made)} images, {before // 1024} KB to {after // 1024} KB, {pages} page(s)")
