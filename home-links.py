#!/usr/bin/env python3
"""Give the home page a links list in the sidebar, in place of the plain outline.

The links come from home-links.txt (one "Label | /path" per line) and come first,
then the page's own in-page links (its outline). The list is titled "Links".

usage: home-links.py public
"""
import html, os, re, sys

public = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
links = [tuple(p.strip() for p in line.split("|", 1)) for line in open(os.path.join(here, "home-links.txt"), encoding="utf-8") if "|" in line]
items = "".join(f'<li class="depth-0 site-link"><a href="{html.escape(h)}" class="internal">{html.escape(l)}</a></li>' for l, h in links)
path = os.path.join(public, "index.html")
t = open(path, encoding="utf-8").read()
t2 = re.sub(r'(<ul id="list-0" class="toc-content[^"]*">)', lambda m: m.group(1) + items, t, count=1)
t2 = t2.replace("<h3>Outline</h3>", "<h3>Links</h3>", 1).replace('aria-label="On this page"', 'aria-label="Links"', 1)
if t2 != t:
    open(path, "w", encoding="utf-8").write(t2)
print("home links added" if t2 != t else "home links: nothing to change")
