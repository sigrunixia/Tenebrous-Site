#!/usr/bin/env python3
"""Keep only the tag pages that are worth visiting.

Quartz writes a page for every tag, including the status tags (todo, doing...),
the tags that only mark a page's role (hub, categories, topics) and the ones on
the CSS test page. A visitor has no use for those, and the type and category
pages replace them. This removes every tag page except for tags written in a
published note's frontmatter, along with the tags index, and takes them out of
the sitemap and the content index (search and the graph). With --redirects it
appends a redirect from /tags to /site-map to _redirects, and does nothing else.

usage: tag-pages.py <public dir> <stage dir> [--redirects]
"""
import json, os, re, shutil, sys

public, stage = sys.argv[1], sys.argv[2]
STRUCTURAL = {"hub", "categories", "topics"}

if "--redirects" in sys.argv:
    p = os.path.join(public, "_redirects")
    t = open(p).read() if os.path.exists(p) else ""
    if "/tags " not in t:
        open(p, "a").write("/tags /site-map 302\n/browse /site-map 301\n")
    sys.exit(0)

def tags_of(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return []
    out, on = [], False
    for line in m.group(1).split("\n"):
        if re.match(r"^tags:\s*$", line):
            on = True
        elif on and re.match(r"^\s+-\s", line):
            out.append(re.sub(r"^\s+-\s*", "", line).strip().strip("\"'#"))
        elif on:
            on = False
    return out

def slug(t):
    return t.lower().replace(" ", "-")

keep = set()
for root, _, files in os.walk(stage):
    for f in files:
        if f.endswith(".md"):
            for t in tags_of(open(os.path.join(root, f), encoding="utf-8").read()):
                if t.lower() not in STRUCTURAL:
                    keep.add(slug(t))

tdir = os.path.join(public, "tags")
removed = 0
if os.path.isdir(tdir):
    for name in sorted(os.listdir(tdir)):
        path = os.path.join(tdir, name)
        base = re.sub(r"(-og-image\.webp|\.html)$", "", name)
        if base in keep:
            continue
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
        removed += name.endswith(".html")

def dead(s):
    m = re.match(r"^/?tags/(.*)$", s)
    return bool(m) and m.group(1).split("/")[0] not in keep

sm = os.path.join(public, "sitemap.xml")
if os.path.exists(sm):
    t = open(sm, encoding="utf-8").read()
    t = re.sub(r"<url>(?:(?!</url>).)*?/tags(?:/[^<]*)?</loc>(?:(?!</url>).)*?</url>", lambda m: m.group(0) if any(f"/tags/{k}<" in m.group(0) for k in keep) else "", t, flags=re.S)
    open(sm, "w", encoding="utf-8").write(t)

ci = os.path.join(public, "static", "contentIndex.json")
if os.path.exists(ci):
    idx = json.load(open(ci, encoding="utf-8"))
    idx = {k: v for k, v in idx.items() if not dead(k)}
    for v in idx.values():
        if isinstance(v.get("links"), list):
            v["links"] = [l for l in v["links"] if not dead(l)]
    json.dump(idx, open(ci, "w", encoding="utf-8"), ensure_ascii=False)
print(f"tag pages removed: {removed}; kept: {sorted(keep) or 'none'}")
