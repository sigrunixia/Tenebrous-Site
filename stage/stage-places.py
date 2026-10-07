#!/usr/bin/env python3
"""Write a page per place into the staged notes, listing the trips there.

The place notes in the vault are not published, so a trip's Where has nowhere
to link. Each page is a Bases card list of the trips whose `locations` name the
place, written into .stage/places/. The place's own name is an alias, so body
links to the place resolve too. A place whose note is published is left alone.

usage: stage-places.py <stage dir>
"""
import collections, datetime, os, re, sys

STAGE = sys.argv[1]
VAULT = os.environ.get("VAULT", "/Users/Signia/Vaults/Tenebrous")

def fm_of(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    out, key = {}, None
    for line in (m.group(1).split("\n") if m else []):
        k = re.match(r"^([A-Za-z_\-]+):\s*(.*)$", line)
        if k:
            key, v = k.group(1), k.group(2).strip().strip("\"'")
            out[key] = [] if v == "" else [v]
        elif key and re.match(r"^\s+-\s", line):
            out.setdefault(key, [])
            out[key].append(re.sub(r"^\s+-\s*", "", line).strip().strip("\"'"))
    return out

def link(v):
    m = re.match(r"^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]$", v.strip())
    return (m.group(1).strip(), (m.group(2) or m.group(1)).strip()) if m else (None, None)

published = set()
trips = []
for root, _, files in os.walk(STAGE):
    for f in files:
        if not f.endswith(".md"):
            continue
        p = os.path.join(root, f)
        fm = fm_of(open(p, encoding="utf-8").read())
        published.add(os.path.splitext(f)[0].lower())
        for t in fm.get("title", []) + fm.get("aliases", []):
            published.add(t.lower())
        if "trip" in fm.get("cssclasses", []):
            trips.append(fm)

def vault_aliases(names):
    """Aliases of the vault notes with these names (the place notes are not published)."""
    want = {n.lower() for n in names}
    found = {}
    for root, dirs, files in os.walk(VAULT):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if f.endswith(".md") and os.path.splitext(f)[0].lower() in want:
                found[os.path.splitext(f)[0].lower()] = fm_of(open(os.path.join(root, f), encoding="utf-8").read()).get("aliases", [])
    return found

places = collections.OrderedDict()   # target -> Counter of display names
hub = None
for fm in trips:
    if hub is None and fm.get("categories"):
        hub = link(fm["categories"][0])[0]
    for v in fm.get("locations", []):
        target, shown = link(v)
        if target:
            places.setdefault(target, collections.Counter())[shown] += 1

if not hub:
    sys.exit("stage-places: no trip category found, nothing written")
greek = [t for t in places if not t.isascii()]
extra = vault_aliases(greek) if greek else {}
os.makedirs(os.path.join(STAGE, "places"), exist_ok=True)
made = 0
for target, shown in places.items():
    if target.lower() in published:
        continue
    title = shown.most_common(1)[0][0]
    english = None
    if not target.isascii():
        # A Greek name is shown with its English one, "Greek - English", the way the
        # hub headings are. The English comes from a display text, else a vault alias.
        english = next((s for s, _ in shown.most_common() if s.isascii()), None) \
            or next((a for a in extra.get(target.lower(), []) if a.isascii()), None)
        if english:
            title = f"{target} - {english}"
    aliases = [target] + [s for s in shown if s != target and s != title]
    if english and english not in aliases:
        aliases.append(english)
    body = f'''---
title: "{title}"
created: {datetime.date.today().isoformat()}
modified: {datetime.date.today().isoformat()}
aliases:
{chr(10).join(f'  - "{a}"' for a in aliases)}
publish: true
cssclasses:
  - κόμβος
---
[[index|Home]] / [[travel|Travel]] / {title}

# {title}

The trips I have taken to {title}, newest first.

```base
filters:
  and:
    - categories.join(",").contains("{hub}")
    - locations.join(",").contains("{target}")
properties:
  note.started:
    displayName: Start
  note.ended:
    displayName: End
  file.name:
    displayName: Trip
views:
  - type: cards
    name: Trips
    order:
      - file.name
      - started
      - ended
    sort:
      - property: started
        direction: DESC
    image: note.cover
```
'''
    name = re.sub(r'[\\/:*?"<>|]', "", english or title)
    open(os.path.join(STAGE, "places", name + ".md"), "w", encoding="utf-8").write(body)
    made += 1
print(f"place pages written: {made}")
