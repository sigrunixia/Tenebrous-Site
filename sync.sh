#!/usr/bin/env bash
# Stages the vault (wikilinks rewritten, unpublished notes left out), then copies the notes, canvases and images in. Run it before building when notes change.
set -euo pipefail
cd "$(dirname "$0")"
bash stage/stage.sh
rm -rf src/notes && mkdir -p src/notes
(cd .stage && find . \( -name '*.md' -o -name '*.canvas' \) -print0 | while IFS= read -r -d '' f; do
  mkdir -p "$OLDPWD/src/notes/$(dirname "$f")" && cp "$f" "$OLDPWD/src/notes/$f"
done)
# Pictures, under the names the notes use (lower case, hyphens). Covers become 800x600 WebP cards, line-icon
# SVGs are copied as they are, and the pictures embedded in notes or placed on a canvas are cut down to 1600 px
# and written as WebP (photo.jpeg becomes photo.jpeg.webp; see imageFile in lib/notes.ts).
/opt/homebrew/opt/python@3/libexec/bin/python3 - <<'PYEND'
import glob, json, os, re, shutil
from PIL import Image, ImageOps
slug = lambda s: re.sub(r"-+", "-", s.lower().replace(" ", "-").replace("&", "-and-")).strip("-")
IMG = re.compile(r"\.(png|jpe?g|webp|gif|svg|avif)$", re.I)
stage = ".stage"
files = {}
for p in glob.glob(f"{stage}/**/*", recursive=True):
    if os.path.isfile(p) and IMG.search(p):
        files[slug(os.path.basename(p))] = p
whole, covers = set(), set()
for note in glob.glob("src/notes/**/*.md", recursive=True):
    text = open(note, encoding="utf-8").read()
    for m in re.finditer(r"!\[\[([^\]|]+)", text):
        whole.add(slug(os.path.basename(m.group(1).strip())))
    for m in re.finditer(r'^cover: *"?\[\[([^\]|#]+)', text, re.M):
        covers.add(slug(os.path.basename(m.group(1).strip())))
for c in glob.glob("src/notes/**/*.canvas", recursive=True):
    for n in json.load(open(c, encoding="utf-8"))["nodes"]:
        if n["type"] == "file":
            whole.add(slug(os.path.basename(n["file"])))
shutil.rmtree("src/img", ignore_errors=True)
os.makedirs("src/img")
for name in sorted(whole | covers):
    src = files.get(name)
    if not src:
        continue
    if name.endswith(".svg"):
        shutil.copy(src, f"src/img/{name}")
        continue
    if name in whole:
        if re.search(r"\.(png|jpe?g|avif|webp)$", name, re.I):
            im = ImageOps.exif_transpose(Image.open(src))
            im.thumbnail((1600, 1600), Image.LANCZOS)
            out = f"src/img/{name}" if name.endswith(".webp") else f"src/img/{name}.webp"
            alpha = im.mode in ("RGBA", "LA", "P")
            im = im.convert("RGBA" if alpha else "RGB")
            lossy = {"quality": 82, "method": 6}
            im.save(out, "WEBP", **lossy)
            # Screenshots and flat graphics stay sharp as lossless when that is not much bigger.
            if name.lower().endswith(".png"):
                im.save(out + ".ll", "WEBP", lossless=True, method=6)
                if os.path.getsize(out + ".ll") <= max(os.path.getsize(out) * 1.5, 150_000):
                    os.replace(out + ".ll", out)
                else:
                    os.remove(out + ".ll")
        else:
            shutil.copy(src, f"src/img/{name}")
    if name in covers:
        out = f"src/img/{os.path.splitext(name)[0]}.card.webp"
        if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src):
            im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
            centre = (0.5, 0.35 if im.height > im.width else 0.5)
            ImageOps.fit(im, (800, 600), Image.LANCZOS, centering=centre).save(out, "WEBP", quality=78, method=6)
PYEND
# Place notes in the vault are not published, but their icon and colour decide the map markers. place-data.js
# puts their properties in places.json and fetches each icon from Lucide once.
VAULT="${VAULT:-$HOME/Vaults/Tenebrous}"
deno run --allow-read --allow-write --allow-net stage/place-data.js "$VAULT"
echo "synced $(find src/notes \( -name '*.md' -o -name '*.canvas' \) | wc -l | tr -d ' ') notes and $(ls src/img | wc -l | tr -d ' ') images"
