#!/usr/bin/env python3
"""Add the links in footer-links.txt ("Label | /path" per line) to every page's footer,
and a feed link to every page's head so feed readers can find the RSS feed.

usage: footer-links.py public
"""
import html, os, re, sys

public = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
links = [tuple(p.strip() for p in line.split("|", 1)) for line in open(os.path.join(here, "footer-links.txt"), encoding="utf-8") if "|" in line]
items = "".join(f'<li><a href="{html.escape(h)}" class="internal">{html.escape(l)}</a></li>' for l, h in links)
feed = '<link rel="alternate" type="application/rss+xml" title="Tenebrous Dragon" href="/index.xml">'
n = 0
for root, _, files in os.walk(public):
    for f in files:
        if not f.endswith(".html"):
            continue
        p = os.path.join(root, f)
        t = open(p, encoding="utf-8").read()
        if "<footer" not in t or "application/rss+xml" in t:
            continue
        t = re.sub(r"(<footer[^>]*>.*?<ul>)(</ul>)", lambda m: m.group(1) + items + m.group(2), t, count=1, flags=re.S)
        t = t.replace("</head>", feed + "</head>", 1)
        open(p, "w", encoding="utf-8").write(t); n += 1
print("footer links and feed link added to", n, "page(s)")
