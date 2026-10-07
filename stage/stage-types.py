#!/usr/bin/env python3
"""Write a page per type and category into the staged notes, listing what is filed there.

A note's `types` and `categories` link to notes that are not published (Road trip,
Flight), so the link has nowhere to go on the site. Each page is a Bases card list
of the published notes that name the target, written into .stage/types/. The
target's name is an alias, so links in the body resolve too. A target that is
published, or that already has an alias page, is left alone.

usage: stage-types.py <stage dir>
"""
import collections, datetime, os, re, sys

STAGE = sys.argv[1]

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
notes = []
for root, _, files in os.walk(STAGE):
    for f in files:
        if f.endswith(".md"):
            fm = fm_of(open(os.path.join(root, f), encoding="utf-8").read())
            published.add(os.path.splitext(f)[0].lower())
            for t in fm.get("title", []) + fm.get("aliases", []):
                published.add(t.lower())
            notes.append(fm)

targets = collections.OrderedDict()   # target -> {"shown": Counter, "fields": set, "trips": [bool]}
for fm in notes:
    for field in ("types", "categories"):
        for v in fm.get(field, []):
            target, shown = link(v)
            if not target or target.lower() in published:
                continue
            t = targets.setdefault(target, {"shown": collections.Counter(), "fields": set(), "trips": []})
            t["shown"][shown] += 1
            t["fields"].add(field)
            t["trips"].append("trip" in fm.get("cssclasses", []))

os.makedirs(os.path.join(STAGE, "types"), exist_ok=True)
made = 0
for target, t in targets.items():
    title = t["shown"].most_common(1)[0][0]
    aliases = [target] + [s for s in t["shown"] if s != target and s != title]
    conds = [f'{f}.join(",").contains("{target}")' for f in sorted(t["fields"])]
    if len(conds) == 1:
        filt = f"  and:\n    - {conds[0]}"
    else:
        filt = "  or:\n" + "\n".join(f"    - {c}" for c in conds)
    trips = all(t["trips"])
    cols = ["file.name", "started", "ended"] if trips else ["file.name", "modified"]
    props = ("  note.started:\n    displayName: Start\n  note.ended:\n    displayName: End\n  file.name:\n    displayName: Trip\n"
             if trips else "  note.modified:\n    displayName: Updated\n  file.name:\n    displayName: Note\n")
    sort = "started" if trips else "modified"
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
[[index|Home]] / [[site-map|Site map]] / {title}

# {title}

Everything filed under {title}, newest first.

```base
filters:
{filt}
properties:
{props.rstrip()}
views:
  - type: cards
    name: {title}
    order:
{chr(10).join(f'      - {c}' for c in cols)}
    sort:
      - property: {sort}
        direction: DESC
    image: note.cover
```
'''
    name = re.sub(r'[\\/:*?"<>|]', "", title)
    open(os.path.join(STAGE, "types", name + ".md"), "w", encoding="utf-8").write(body)
    made += 1
print(f"type pages written: {made}")
