#!/usr/bin/env python3
"""Keep breadcrumb links out of the graph.

Nearly every note opens with Home / Hub / Title, so nearly every note links to
the home page and its hub, which turns their graphs into hairballs. Quartz builds
the graph from the content index, so drop a link from a page's entry when it
appears only in that page's breadcrumb line. The links in the pages stay.

usage: graph-links.py <public dir> <stage dir>
"""
import json, os, re, sys

public, stage = sys.argv[1], sys.argv[2]
index_path = os.path.join(public, "static", "contentIndex.json")
index = json.load(open(index_path, encoding="utf-8"))

crumb_re = re.compile(r"^\[\[[^\]]+\]\](?: / (?:\[\[[^\]]+\]\]|[^\[\]/\n]+))+\s*$")
link_re = re.compile(r"\[\[([^\]|#]+)")

def slug(text):
    return re.sub(r"\s+", "-", text.strip().lower())

def link_slug(text):
    """The index page is stored in link lists as "/"."""
    s = slug(text)
    return "/" if s == "index" else s

removed = 0
for root, _, files in os.walk(stage):
    for f in files:
        if not f.endswith(".md"):
            continue
        p = os.path.join(root, f)
        rel = os.path.relpath(p, stage)[:-3]
        entry = index.get(slug(rel))
        if not entry:
            continue
        m = re.match(r"---\n.*?\n---\n?(.*)", open(p, encoding="utf-8").read(), re.S)
        lines = m.group(1).split("\n") if m else []
        first = next((i for i, l in enumerate(lines) if l.strip()), None)
        if first is None or not crumb_re.match(lines[first]):
            continue
        crumb = {link_slug(t) for t in link_re.findall(lines[first])}
        rest = {link_slug(t) for t in link_re.findall("\n".join(lines[:first] + lines[first + 1:]))}
        only_crumb = crumb - rest
        before = len(entry["links"])
        entry["links"] = [l for l in entry["links"] if l not in only_crumb]
        removed += before - len(entry["links"])

json.dump(index, open(index_path, "w", encoding="utf-8"), ensure_ascii=False)
print("breadcrumb links removed from the graph data:", removed)
