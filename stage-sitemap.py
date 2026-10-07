#!/usr/bin/env python3
"""Write the Site map page, an index of every way into the site.

It lists the hub pages, the kinds (types and categories), the places and the tags,
from the staged notes. Run after stage-places.py and stage-types.py.

usage: stage-sitemap.py <stage dir>
"""
import datetime, os, re, sys

STAGE = sys.argv[1]
STRUCTURAL = {"hub", "categories", "topics"}   # tags that only mark a page's role

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

def title_of(path, fm):
    """The title, or its first plain-ASCII alias when the title is in Greek (Travel, not Τα ταξίδια)."""
    title = (fm.get("title") or [os.path.splitext(os.path.basename(path))[0]])[0]
    if title.isascii():
        return title
    return next((a for a in fm.get("aliases", []) if a.isascii()), title)

hubs, kinds, places, tags = [], [], [], set()
for root, _, files in os.walk(STAGE):
    for f in sorted(files):
        if not f.endswith(".md"):
            continue
        p = os.path.join(root, f)
        rel = os.path.relpath(p, STAGE)
        fm = fm_of(open(p, encoding="utf-8").read())
        name = os.path.splitext(f)[0]
        entry = (title_of(p, fm) if "κόμβος" in fm.get("cssclasses", []) and not rel.startswith(("places", "types")) else (fm.get("title") or [name])[0], name)
        for t in fm.get("tags", []):
            if t.lower() not in STRUCTURAL:
                tags.add(t)
        if rel.startswith("types" + os.sep):
            kinds.append(entry)
        elif rel.startswith("places" + os.sep):
            places.append(entry)
        elif "κόμβος" in fm.get("cssclasses", []) and rel not in ("index.md", "site-map.md"):
            hubs.append(entry)

def lst(items):
    return "\n".join(f"- [[{n}|{t}]]" for t, n in sorted(items, key=lambda e: e[0].lower())) + "\n"

out = f'''---
title: Site map
created: {datetime.date.today().isoformat()}
modified: {datetime.date.today().isoformat()}
publish: true
cssclasses:
  - κόμβος
---
[[index|Home]] / Site map

# Site map

You can also use the search bar or the graph button beside it.

## Hubs

The main parts of the site.

{lst(hubs)}
## Kinds

What the notes are, such as a road trip or a flight.

{lst(kinds)}
## Places

Where I have been.

{lst(places)}
'''
if tags:
    out += "\n## Tags\n\n" + "\n".join(f"- [{t}](/tags/{t.lower().replace(' ', '-')})" for t in sorted(tags, key=str.lower)) + "\n"
open(os.path.join(STAGE, "site-map.md"), "w", encoding="utf-8").write(out)
print(f"site map page written: {len(hubs)} hubs, {len(kinds)} kinds, {len(places)} places, {len(tags)} tags")
