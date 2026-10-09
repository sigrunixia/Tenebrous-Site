#!/usr/bin/env python3
"""Adds the click-to-zoom script to every page that has an article.

usage: lightbox.py public
"""
import os, sys

n = 0
for root, _, files in os.walk(sys.argv[1]):
    for f in files:
        if not f.endswith(".html"):
            continue
        p = os.path.join(root, f)
        t = open(p, encoding="utf-8").read()
        if "<article" not in t or "lightbox.js" in t:
            continue
        t = t.replace("</head>", '<script src="/static/lightbox.js" defer></script></head>', 1)
        open(p, "w", encoding="utf-8").write(t)
        n += 1
print(f"click to zoom on {n} page(s)")
