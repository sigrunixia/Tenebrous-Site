#!/usr/bin/env python3
"""Write public/_redirects so old Obsidian Publish URLs still work.

Publish served a note without a permalink at its vault path (Trips/2026-10
Chicago). Quartz serves it at a lowercase slug (trips/2026-10-chicago). Notes
with a permalink already live at that URL, so they need nothing. Cloudflare
reads _redirects from the assets folder.
"""
import os, re, sys, urllib.parse

STAGE = sys.argv[1] if len(sys.argv) > 1 else ".stage"
PUBLIC = sys.argv[2] if len(sys.argv) > 2 else "public"

def slug(rel):
    """Quartz's slug: lower case, spaces to hyphens, a few characters spelled out.
    Letters in any script and commas stay (a Greek name keeps its Greek)."""
    def one(p):
        p = p.lower().replace(" ", "-").replace("&", "-and-").replace("%", "-percent").replace("?", "-q").replace("#", "-h")
        return re.sub(r"-+", "-", p).strip("-")
    return "/".join(one(p) for p in rel.split("/"))

rules = []
for root, _, files in os.walk(STAGE):
    for f in files:
        if not f.endswith(".md"):
            continue
        rel = os.path.relpath(os.path.join(root, f), STAGE)[:-3]
        if rel.startswith(("places/", "types/")) or rel == "site-map":   # generated, never on Publish
            continue
        new = slug(rel)
        if rel == new or not os.path.exists(os.path.join(PUBLIC, new + ".html")):
            continue
        rules.append((rel, new))
lines = []
for old, new in sorted(rules):
    lines.append(f"/{urllib.parse.quote(old)} /{new} 301")
    if " " in old:
        lines.append(f"/{old.replace(' ', '+')} /{new} 301")
extra = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extra-redirects.txt")
if os.path.exists(extra):   # old addresses of notes that have since gained a permalink
    lines += [l.strip() for l in open(extra, encoding="utf-8") if l.strip() and not l.startswith("#")]
open(os.path.join(PUBLIC, "_redirects"), "w").write("\n".join(lines) + "\n")
print(f"old Publish URLs redirected: {len(rules)}")
