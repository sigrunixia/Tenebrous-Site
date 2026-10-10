#!/usr/bin/env bash
# Stages the vault (wikilinks rewritten, unpublished notes left out), then copies the notes, canvases and images in. Run it before building when notes change.
set -euo pipefail
cd "$(dirname "$0")"
bash stage/stage.sh
rm -rf src/notes && mkdir -p src/notes src/img
(cd .stage && find . \( -name '*.md' -o -name '*.canvas' \) -print0 | while IFS= read -r -d '' f; do
  mkdir -p "$OLDPWD/src/notes/$(dirname "$f")" && cp "$f" "$OLDPWD/src/notes/$f"
done)
# Pictures, under the names the notes use (lower case, hyphens). Covers become 800x600 WebP cards, line-icon
# SVGs are copied as they are, and the pictures embedded in notes or placed on a canvas are copied whole.
python3 - <<'PYEND'
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
os.makedirs("src/img", exist_ok=True)
for name in sorted(whole | covers):
    src = files.get(name)
    if not src:
        continue
    if name.endswith(".svg"):
        shutil.copy(src, f"src/img/{name}")
        continue
    if name in whole:
        shutil.copy(src, f"src/img/{name}")
    if name in covers:
        out = f"src/img/{os.path.splitext(name)[0]}.card.webp"
        if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(src):
            im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
            centre = (0.5, 0.35 if im.height > im.width else 0.5)
            ImageOps.fit(im, (800, 600), Image.LANCZOS, centering=centre).save(out, "WEBP", quality=78, method=6)
PYEND
# Place notes in the vault are not published, but their icon and colour decide the map markers. Their
# properties go in places.json by every name a trip might use, and each icon is fetched once from Lucide.
VAULT="${VAULT:-$HOME/Vaults/Tenebrous}"
python3 - "$VAULT" <<'PYEND'
import glob, json, os, re, shutil, sys, urllib.request
vault = sys.argv[1]
places, icons = {}, set()
for path in glob.glob(os.path.join(vault, "Reference/Places/*.md")):
    m = re.match(r"---\n(.*?)\n---", open(path, encoding="utf-8").read(), re.S)
    if not m:
        continue
    props, key = {}, None
    for line in m.group(1).split("\n"):
        k = re.match(r"^([A-Za-z_\-]+):[ \t]*(.*)$", line)
        if k:
            key, v = k.group(1), k.group(2).strip().strip("\"'")
            props[key] = [] if v == "" else v
        elif key and re.match(r"^\s+-\s", line):
            if not isinstance(props[key], list):
                props[key] = [props[key]] if props[key] else []
            props[key].append(re.sub(r"^\s+-\s*", "", line).strip().strip("\"'"))
    names = [os.path.splitext(os.path.basename(path))[0]] + (props.get("aliases") or [])
    for n in names:
        places.setdefault(n.lower(), props)
    if isinstance(props.get("icon"), str):
        icons.add(props["icon"])
json.dump(places, open("places.json", "w", encoding="utf-8"), ensure_ascii=False)
os.makedirs("src/static/lucide", exist_ok=True)
for icon in sorted(icons):
    dest = f"src/static/lucide/{icon}.svg"
    if not os.path.exists(dest):
        try:
            urllib.request.urlretrieve(f"https://unpkg.com/lucide-static/icons/{icon}.svg", dest)
        except Exception:
            print(f"no Lucide icon {icon!r}", file=sys.stderr)
print(f"{len(places)} place names, {len(icons)} icons")
PYEND
echo "synced $(find src/notes \( -name '*.md' -o -name '*.canvas' \) | wc -l | tr -d ' ') notes and $(ls src/img | wc -l | tr -d ' ') images"
