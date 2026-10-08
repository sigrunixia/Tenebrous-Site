#!/usr/bin/env python3
"""Add the links in footer-links.txt ("Label | /path" per line) to every page's footer,
replace its "Created with Quartz" line with three lines (the copyright, what the site is made with, and when
it was built and from which commit), and add a feed link to every page's head so feed readers can find the RSS feed.

usage: footer-links.py public
"""
import datetime, html, os, re, subprocess, sys

public = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
links = [tuple(p.strip() for p in line.split("|", 1)) for line in open(os.path.join(here, "data", "footer-links.txt"), encoding="utf-8") if "|" in line]
items = "".join(f'<li><a href="{html.escape(h)}" class="internal">{html.escape(l)}</a></li>' for l, h in links)
feed = '<link rel="alternate" type="application/rss+xml" title="Tenebrous Dragon" href="/index.xml">'

def git(*args):
    return subprocess.run(["git", "-C", os.path.join(here, ".."), *args], capture_output=True, text=True).stdout.strip()

built = datetime.datetime.now().astimezone().strftime("%-d %B %Y, %H:%M %Z")
# The commit number counts only her own commits, not the Quartz history the fork carries.
count, short = git("rev-list", "--count", "HEAD", "--author=sigrunixia@tenebrousdragon.com"), git("rev-parse", "HEAD")
commit = f'<a href="https://github.com/sigrunixia/Tenebrous-Site/commit/{short}" class="external">{count}</a>' if count and short else ""
year = datetime.datetime.now().year
mine = f'<p>© {year} <a href="/sigrunixia" class="internal">Rebbecca Bishop (Sigrunixia)</a></p>'
made = ('<p>Written in <a href="https://obsidian.md" class="external">Obsidian</a>, Hosted on '
        '<a href="https://www.cloudflare.com" class="external">Cloudflare</a> via '
        '<a href="https://quartz.jzhao.xyz" class="external">Quartz</a>, and still holding.</p>')
updated = f"<p>Updated {built}" + (f" - Commit {commit}" if commit else "") + "</p>"
n = 0
for root, _, files in os.walk(public):
    for f in files:
        if not f.endswith(".html"):
            continue
        p = os.path.join(root, f)
        t = open(p, encoding="utf-8").read()
        if "application/rss+xml" in t:
            continue
        if "<footer" not in t:
            if "canvas-page" not in t:
                continue
            # A canvas fills the window and has no footer of its own, so it gets a slim one.
            t = t.replace("</body>", f'<footer class="canvas-footer">{mine}{updated}<ul>{items}</ul></footer></body>', 1)
            t = t.replace("</head>", feed + "</head>", 1)
            open(p, "w", encoding="utf-8").write(t); n += 1
            continue
        t = re.sub(r"(<footer[^>]*>)<p>Created with <a [^>]*>Quartz[^<]*</a>[^<]*</p>", lambda m: m.group(1) + mine + made + updated, t, count=1)
        t = re.sub(r"(<footer[^>]*>.*?<ul>)(</ul>)", lambda m: m.group(1) + items + m.group(2), t, count=1, flags=re.S)
        t = t.replace("</head>", feed + "</head>", 1)
        open(p, "w", encoding="utf-8").write(t); n += 1
print("footer links and feed link added to", n, "page(s)")
