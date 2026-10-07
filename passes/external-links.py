#!/usr/bin/env python3
"""Make every external link look and act the same.

A link to another website gets the arrow icon, opens in a new tab, and says so to
screen readers. Quartz does this for links in a note's text only (the icon, and no new
tab). Links the build adds itself, such as the footer and the photo credit, had neither.
The colour comes from theme/src/_tenebrism.scss.

usage: external-links.py public
"""
import os, re, sys

public = sys.argv[1]
ICON = ('<svg aria-hidden="true" class="external-icon" style="max-width:0.8em;max-height:0.8em;" viewBox="0 0 512 512">'
        '<path d="M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z"></path></svg>')
HIDDEN = '<span class="visually-hidden"> (opens in a new tab)</span>'
link = re.compile(r'<a\b([^>]*)>(.*?)</a>', re.S)
n = 0

def fix(m):
    global n
    attrs, inner = m.group(1), m.group(2)
    cls = re.search(r'\bclass="([^"]*)"', attrs)
    href = re.search(r'\bhref="(https?://[^"]*)"', attrs)
    if not (cls and href and "external" in cls.group(1).split()):
        return m.group(0)
    new_tab = 'target="_blank"' in attrs
    told = "opens in a new tab" in inner or "opens in a new tab" in attrs
    if not new_tab:
        attrs += ' target="_blank" rel="noopener noreferrer"'
        if 'aria-label="' in attrs:
            attrs = re.sub(r'aria-label="([^"]*)"', r'aria-label="\1 (opens in a new tab)"', attrs, count=1)
            told = True
    changed = not new_tab
    if "external-icon" not in inner and "<img" not in inner:
        inner += ICON
        changed = True
    if not told:
        inner += HIDDEN
        changed = True
    if not changed:
        return m.group(0)
    n += 1
    return f"<a{attrs}>{inner}</a>"

for root, _, files in os.walk(public):
    for f in files:
        if not f.endswith(".html"):
            continue
        p = os.path.join(root, f)
        t = open(p, encoding="utf-8").read()
        out = link.sub(fix, t)
        if out != t:
            open(p, "w", encoding="utf-8").write(out)
print("external links fixed:", n)
