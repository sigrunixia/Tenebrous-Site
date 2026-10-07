#!/usr/bin/env python3
"""Add the site header bar, and put the logo and social links at the top of the
left sidebar, on every page.
usage: inject-chrome.py <public dir> <chrome html file> <site title>"""
import html, os, re, sys
RSS = ('<a class="site-social-link" href="/index.xml" aria-label="RSS feed" title="RSS feed">'
       '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" '
       'stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"></path>'
       '<path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg></a>')
public, chrome, title = sys.argv[1], open(sys.argv[2], encoding="utf-8").read(), sys.argv[3]
# The feed link goes at the end of the social links.
chrome = re.sub(r'(<div class="site-social-links">.*?)(</div>)', lambda m: m.group(1) + RSS + m.group(2), chrome, count=1, flags=re.S)
bar = '<header class="site-header"><a class="site-header-text" href="/">%s</a></header>' % html.escape(title)
body = '<div id="quartz-body">'
sidebar = '<div class="left sidebar">'
n = 0
for root, _, files in os.walk(public):
    for f in files:
        if f.endswith(".html"):
            p = os.path.join(root, f)
            h = open(p, encoding="utf-8").read()
            if body not in h:
                continue
            h = h.replace(body, bar + body, 1)
            if sidebar in h:
                h = h.replace(sidebar, sidebar + chrome, 1)
            open(p, "w", encoding="utf-8").write(h)
            n += 1
print("header, logo and social links added to", n, "page(s)")
