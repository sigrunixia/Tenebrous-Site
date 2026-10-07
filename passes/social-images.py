#!/usr/bin/env python3
"""Fix the preview image in each page's social meta tags.

A note with a `cover` property gives Quartz the raw wikilink, so og:image reads
"https://.../static/[[2026-08 Athens cover.jpg]]" and shared links show no picture.
This points the tags at the cover image in public/, with its real type and size.
A cover that is not a photo (an SVG icon) falls back to the default preview image.

usage: social-images.py public
"""
import os, re, sys
from urllib.parse import quote
from PIL import Image

public = sys.argv[1]
SITE = "https://tenebrousdragon.com"
FALLBACK = "static/og-image.png"
TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

def slug(name):
    p = name.lower().replace(" ", "-").replace("&", "-and-").replace("%", "-percent").replace("?", "-q").replace("#", "-h")
    return re.sub(r"-+", "-", p).strip("-")

images = {}
for root, _, files in os.walk(public):
    for f in files:
        if os.path.splitext(f)[1].lower() in TYPES and not f.endswith(".card.webp"):
            images.setdefault(f.lower(), os.path.relpath(os.path.join(root, f), public))

meta = re.compile(r'content="' + re.escape(SITE) + r'/static/\[\[([^\]]*)\]\]"')
n = 0
for root, _, files in os.walk(public):
    for f in files:
        if not f.endswith(".html"):
            continue
        p = os.path.join(root, f)
        t = open(p, encoding="utf-8").read()
        m = meta.search(t)
        if not m:
            continue
        rel = images.get(slug(os.path.basename(m.group(1)))) or FALLBACK
        ext = os.path.splitext(rel)[1].lower()
        with Image.open(os.path.join(public, rel)) as im:
            w, h = im.size
        url = f"{SITE}/{quote(rel)}"
        t = meta.sub(f'content="{url}"', t)
        t = re.sub(r'(<meta property="og:image:type" content=")[^"]*("/>)', rf'\g<1>{TYPES[ext]}\2', t)
        if 'property="og:image:width"' not in t:
            t = t.replace('<meta property="og:image:type"', f'<meta property="og:image:width" content="{w}"/><meta property="og:image:height" content="{h}"/><meta property="og:image:type"', 1)
        open(p, "w", encoding="utf-8").write(t)
        n += 1
print("social images fixed on", n, "page(s)")
