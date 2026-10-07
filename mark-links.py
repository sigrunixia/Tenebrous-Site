#!/usr/bin/env python3
"""Mark what Quartz leaves unmarked, in the built HTML.

- A link to a note that was not published becomes a plain <span class="unresolved">.
  A link that leads to a 404 is a false promise for a screen reader, and the
  theme gives the span a very faint underline so the name still shows as a thing.
- A line that starts with a status tag gets "tag-line tl-<tag>", and every status
  tag link gets "tl-<tag>", so the tag lines need no :has().
- A highlight that starts with a colour emoji gets a class such as hl-red, so
  the six colours Obsidian offers (circles, squares and hearts, ten colours) can be told apart.
"""
import os, re, sys

PUBLIC = sys.argv[1] if len(sys.argv) > 1 else "public"
# Circles, squares and hearts all work, and each maps to one colour.
COLOURS = {
    "red": "🔴🟥❤️", "orange": "🟠🟧🧡", "yellow": "🟡🟨💛", "green": "🟢🟩💚",
    "blue": "🔵🟦💙", "purple": "🟣🟪💜", "cyan": "🩵", "pink": "🩷",
    "brown": "🟤🟫🤎", "silver": "⚪⬜🤍",
}
import itertools
EMOJI = {}
for name, chars in COLOURS.items():
    for ch in re.findall(r"[^\ufe0f]\ufe0f?", chars):
        EMOJI[ch] = name

def exists(slug):
    slug = slug.split("#")[0].split("?")[0].strip("/")
    if slug == "":
        return True
    return any(os.path.exists(os.path.join(PUBLIC, slug + e)) for e in (".html", "/index.html", ""))

link = re.compile(r'<a href="(\.\.?/[^"]*)" class="([^"]*\binternal\b[^"]*)"([^>]*)>(.*?)</a>', re.S)
hl = re.compile(r'<span class="text-highlight">(' + "|".join(sorted(map(re.escape, EMOJI), key=len, reverse=True)) + ")")

STATUS = "todo|doing|waiting|blocked|completed|canceled|important|question"
pill = re.compile(r'<a href="([^"]*)" class="(tag-link [^"]*)" data-slug="tags/(' + STATUS + r')"')
# The status tag is the first thing in a paragraph, list item or heading, and the
# element has no hard line break (reading view joins consecutive lines with one).
line = re.compile(r'<(p|li|h[1-6])((?: [^>]*)?)>(<a [^>]*class="tag-link [^"]*"[^>]*data-slug="tags/(?:' + STATUS + r')"[^>]*>.*?)</\1>', re.S)

links = marks = lines = 0
for root, _, files in os.walk(PUBLIC):
    for name in files:
        if not name.endswith(".html"):
            continue
        path = os.path.join(root, name)
        s = open(path, encoding="utf-8").read()
        rel = os.path.relpath(root, PUBLIC)
        base = PUBLIC if rel == "." else root

        def fix_link(m):
            global links
            href = m.group(1)
            # Quartz writes ./slug or ../slug relative to the page; ./ is used here.
            target = os.path.normpath(os.path.join(base, href)).replace(PUBLIC, "", 1)
            if exists(target):
                return m.group(0)
            if "tag-link" in m.group(2):
                # A tag with no page (a status tag) stays a pill, but not a link.
                return f'<span class="{m.group(2).replace(" internal-link", "").replace("internal ", "")}">{m.group(4)}</span>'
            links += 1
            return f'<span class="unresolved" title="No page on the site">{m.group(4)}</span>'

        def fix_hl(m):
            global marks
            marks += 1
            return f'<span class="text-highlight hl-{EMOJI[m.group(1)]}">{m.group(1)}'

        def fix_line(m):
            global lines
            if "<br" in m.group(3):
                return m.group(0)
            tag = re.search(r'data-slug="tags/(\w+)"', m.group(3)).group(1)
            lines += 1
            attrs = m.group(2)
            if 'class="' in attrs:
                attrs = attrs.replace('class="', f'class="tag-line tl-{tag} ', 1)
            else:
                attrs += f' class="tag-line tl-{tag}"'
            return f"<{m.group(1)}{attrs}>{m.group(3)}</{m.group(1)}>"

        t = line.sub(fix_line, s)
        t = pill.sub(lambda m: f'<a href="{m.group(1)}" class="{m.group(2)} tl-{m.group(3)}" data-slug="tags/{m.group(3)}"', t)
        t = hl.sub(fix_hl, link.sub(fix_link, t))
        if t != s:
            open(path, "w", encoding="utf-8").write(t)
print(f"unresolved links marked: {links}, coloured highlights: {marks}, tag lines: {lines}")
