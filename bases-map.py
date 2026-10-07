#!/usr/bin/env python3
"""Turn the Bases plugin's "Unknown view type: map" into a Leaflet map.

The marker data is the MAPS table that the Publish build baked into
Tenebrous-Obsidian/src/scripts/baked-data.ts (name, coordinates, icon and
colour per trip, limited to published notes). Each marker is pointed at its
note's new URL. quartz/static/base-map.js draws the map in the browser. To
refresh the markers after trips change, run build-index.js in the theme repo
(Tenebrous/build.sh --obsidian-publish-js --build-only) and build again.

usage: bases-map.py public .stage baked-data.ts
"""
import html, json, os, re, sys, urllib.error, urllib.request

PUBLIC, STAGE, BAKED = sys.argv[1], sys.argv[2], sys.argv[3]
CACHE = os.path.join(".build", "lucide")
PLACEHOLDER = '<div class="bases-empty">Unknown view type: map</div>'

def slug(rel):
    """Quartz's slug: lower case, spaces to hyphens, a few characters spelled out.
    Letters in any script and commas stay (a Greek name keeps its Greek)."""
    def one(p):
        p = p.lower().replace(" ", "-").replace("&", "-and-").replace("%", "-percent").replace("?", "-q").replace("#", "-h")
        return re.sub(r"-+", "-", p).strip("-")
    return "/".join(one(p) for p in rel.split("/"))

def title_of(text):
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    t = re.search(r'^title: *"?(.*?)"? *$', m.group(1), re.M) if m else None
    return t.group(1).strip() if t else None

staged = {}  # title -> relative path without .md
for root, _, files in os.walk(STAGE):
    for f in files:
        if f.endswith(".md"):
            p = os.path.join(root, f)
            t = title_of(open(p, encoding="utf-8").read())
            if t:
                staged[t.lower()] = os.path.relpath(p, STAGE)[:-3]

def page_slug(note_path):
    """The built URL slug of a vault note, or None if it was not published."""
    rel = note_path[:-3] if note_path.endswith(".md") else note_path
    if os.path.exists(os.path.join(STAGE, rel + ".md")):
        s = slug(rel)
    else:
        found = staged.get(os.path.basename(rel).lower())
        s = slug(found) if found else None
    return s if s and os.path.exists(os.path.join(PUBLIC, s + ".html")) else None

def icon(name):
    """Fetch a Lucide icon into the page assets. False if Lucide has no such icon."""
    dest = os.path.join(PUBLIC, "static", "lucide", name + ".svg")
    cached = os.path.join(CACHE, name + ".svg")
    if not os.path.exists(cached):
        os.makedirs(CACHE, exist_ok=True)
        try:
            urllib.request.urlretrieve(f"https://unpkg.com/lucide-static/icons/{name}.svg", cached)
        except urllib.error.HTTPError:
            return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, "w").write(open(cached).read())
    return True

src = open(BAKED, encoding="utf-8").read()
m = re.search(r"export const MAPS[^=]*= (\{.*?\}); /\* @MAPS \*/", src, re.S)
maps = json.loads(m.group(1)) if m else {}

done = 0
for key, data in maps.items():
    note = key.rsplit("#", 1)[0]
    page = staged.get(os.path.basename(note)[:-3].lower() if note.endswith(".md") else note.lower())
    if not page:
        print(f"map {key}: its note is not published, skipped", file=sys.stderr)
        continue
    markers = []
    for mk in data["markers"]:
        url = page_slug(mk["path"])
        if not url:
            print(f"  marker {mk['name']}: not published, left off", file=sys.stderr)
            continue
        if mk.get("icon") and not icon(mk["icon"]):
            print(f"  marker {mk['name']}: Lucide has no icon {mk['icon']!r}, shown as a plain dot", file=sys.stderr)
            mk["icon"] = None
        markers.append({"name": mk["name"], "lat": mk["lat"], "lng": mk["lng"],
                        "icon": mk.get("icon"), "color": mk.get("color"), "url": "/" + url})
    payload = html.escape(json.dumps({"zoom": data.get("zoom"), "center": data.get("center"), "markers": markers},
                                     ensure_ascii=False), quote=True)
    path = os.path.join(PUBLIC, page + ".html")
    text = open(path, encoding="utf-8").read()
    if PLACEHOLDER not in text:
        continue
    text = text.replace(PLACEHOLDER, f'<div class="base-map-embed" data-map="{payload}" role="region" aria-label="Map of the trips"></div>')
    open(path, "w", encoding="utf-8").write(text)
    done += 1

# The loader goes on every page so it still runs after in-site navigation. It
# only fetches Leaflet when a page has a map.
tag = '<script src="/static/base-map.js" defer></script>'
for root, _, files in os.walk(PUBLIC):
    for f in files:
        if f.endswith(".html"):
            p = os.path.join(root, f)
            t = open(p, encoding="utf-8").read()
            if tag not in t and "</head>" in t:
                open(p, "w", encoding="utf-8").write(t.replace("</head>", tag + "</head>", 1))
print(f"maps added: {done}")
