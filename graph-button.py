#!/usr/bin/env python3
"""Adds a graph button beside the reader-mode button, and its script.

usage: graph-button.py public
"""
import os, re, sys

ICON = ('<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        'width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>'
        '<circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>')
BUTTON = ('<div style="flex-grow: 0; flex-shrink: 1; flex-basis: auto; order: 0; align-self: center; justify-self: center;">'
          f'<button type="button" class="graph-open" aria-label="Open graph view">{ICON}</button></div>')
rm = re.compile(r'(<button class="readermode".*?</button></div>)', re.S)
CLOSE = ('<button type="button" class="graph-close" aria-label="Close graph view">'
         '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" '
         'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
         '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>')
gg = re.compile(r'(<div class="global-graph-container".*?</div>)(</div>)', re.S)
n = 0
for root, _, files in os.walk(sys.argv[1]):
    for f in files:
        if not f.endswith(".html"):
            continue
        p = os.path.join(root, f)
        t = open(p, encoding="utf-8").read()
        if "graph-open" in t or 'class="readermode"' not in t:
            continue
        t = gg.sub(lambda m: m.group(1) + CLOSE + m.group(2), t, count=1)
        t = rm.sub(lambda m: m.group(1) + BUTTON, t, count=1)
        t = t.replace("</head>", '<script src="/static/graph-button.js" defer></script></head>', 1)
        open(p, "w", encoding="utf-8").write(t); n += 1
print("graph button added to", n, "page(s)")
