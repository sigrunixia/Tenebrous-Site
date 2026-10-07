#!/usr/bin/env python3
"""Helps with long pages.

- On a page with three or more headings, a collapsed "On this page" list goes after
  the title (shown on phones only, where the sidebar outline is hidden). Its links
  are copied from the sidebar outline.
- Every page gets a back-to-top button and its script.

usage: page-nav.py public
"""
import os, re, sys

ARROW = ('<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
         'width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
         'stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>')
BUTTON = f'<button type="button" class="back-to-top" aria-label="Back to top" hidden>{ARROW}</button>'
outline = 0
total = 0
for root, _, files in os.walk(sys.argv[1]):
    for f in files:
        if not f.endswith(".html"):
            continue
        p = os.path.join(root, f)
        t = open(p, encoding="utf-8").read()
        if "<footer" not in t or "back-to-top" in t:
            continue
        items = re.findall(r'<li class="depth-(\d)"><a href="(#[^"]+)"[^>]*>(.*?)</a></li>', t, re.S)
        if len(items) >= 3 and "<h1" in t and 'class="site-link"' not in t and "list-0" in t and not p.endswith("/index.html") and f != "index.html":
            lis = "".join(f'<li class="depth-{d}"><a href="{h}">{x}</a></li>' for d, h, x in items)
            block = ('<details class="page-outline-mobile"><summary>On this page</summary>'
                     f'<nav aria-label="On this page, short list"><ul>{lis}</ul></nav></details>')
            if '<aside class="infobox infobox-inline"' in t:
                t = re.sub(r'(<aside class="infobox infobox-inline".*?</aside>)', lambda m: m.group(1) + block, t, count=1, flags=re.S)
            else:
                t = t.replace("</h1>", "</h1>" + block, 1)
            outline += 1
        t = t.replace("</footer>", "</footer>" + BUTTON, 1)
        t = t.replace("</head>", '<script src="/static/back-to-top.js" defer></script></head>', 1)
        open(p, "w", encoding="utf-8").write(t)
        total += 1
print(f"back-to-top on {total} page(s), mobile outline on {outline} page(s)")
