#!/usr/bin/env python3
"""Accessibility fixes on the built pages, for what Quartz leaves out.

- A skip link, and landmarks: main, search, breadcrumb and outline navigation,
  the sidebar as complementary, the social links as navigation.
- Greek text is wrapped in lang="el", so a screen reader switches voice.
- Decorative svg icons are hidden from assistive technology.
- Task-list checkboxes get a name from their line of text.
- A link that opens a new tab says so (as hidden text, or in its aria-label).
- Photos get alt text from their caption (a caption callout), or from the title
  of the callout they sit in. Photos with neither are listed in a11y-alt-todo.txt,
  for alt text written in the vault as ![[photo.jpg|what is in it]].
- A page with no h1 (a canvas) gets a visually hidden one from its title.

usage: a11y-fix.py public
"""
import html, os, re, sys

PUBLIC = sys.argv[1] if len(sys.argv) > 1 else "public"
GREEK_WORD = r"[Ͱ-Ͽἀ-῿]+(?:[’'\-][Ͱ-Ͽἀ-῿]+)*"
GREEK_RUN = re.compile(rf"{GREEK_WORD}(?: {GREEK_WORD})*")

def text_of(frag):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", frag))).strip()

def lang_greek(body):
    """Wrap Greek runs in text (not inside tags, scripts or styles) in lang=el."""
    parts = re.split(r"(<[^>]+>)", body)
    skip = None
    for i, part in enumerate(parts):
        if part.startswith("<"):
            m = re.match(r"<(/?)(script|style|svg|textarea|title)\b", part, re.I)
            if m:
                skip = None if m.group(1) else m.group(2).lower()
            continue
        if skip:
            continue
        parts[i] = GREEK_RUN.sub(lambda g: f'<span lang="el">{g.group(0)}</span>', part)
    return "".join(parts)

def set_alt(tag, alt):
    alt = html.escape(alt, quote=True)
    if re.search(r'\balt="[^"]*"', tag):
        return re.sub(r'\balt="[^"]*"', f'alt="{alt}"', tag, count=1)
    if re.search(r"\balt(?=[\s/>])", tag):
        return re.sub(r"\balt(?=[\s/>])", f'alt="{alt}"', tag, count=1)
    return tag.replace("<img", f'<img alt="{alt}"', 1)

def empty_alt(tag):
    m = re.search(r'\balt="([^"]*)"', tag)
    return (m.group(1).strip() == "") if m else True

todo = []
changed = 0
for root, _, files in os.walk(PUBLIC):
    for f in sorted(files):
        if not f.endswith(".html"):
            continue
        path = os.path.join(root, f); rel = os.path.relpath(path, PUBLIC)
        t = open(path, encoding="utf-8").read()
        if 'http-equiv="refresh"' in t or "<body" not in t:
            continue
        orig = t
        head, body = t.split("<body", 1)
        body = "<body" + body

        # Alt text from captions, then from the callout title.
        def callout_block(m):
            block = m.group(0)
            kind = m.group(1)
            def img_fix(im):
                tag = im.group(0)
                if not empty_alt(tag):
                    return tag
                if kind == "caption":
                    caps = [text_of(p) for p in re.findall(r"<p>(.*?)</p>", block, re.S) if "<img" not in p and text_of(p)]
                    alt = caps[0] if caps else ""
                else:
                    ti = re.search(r'callout-title-inner">(.*?)</div>', block, re.S)
                    alt = text_of(ti.group(1)) if ti else ""
                alt = alt[:200]
                if alt:
                    return set_alt(tag, alt)
                return tag
            return re.sub(r"<img\b[^>]*>", img_fix, block)
        body = re.sub(r'<blockquote class="callout [^"]*?" data-callout="([a-z-]+)".*?</blockquote>', callout_block, body, flags=re.S)

        # Anything still without alt inside the article is a to-do for the author.
        art = re.search(r"<article.*?</article>", body, re.S)
        if art:
            for im in re.findall(r"<img\b[^>]*>", art.group(0)):
                if empty_alt(im) and "infobox" not in im and "tenebrous-dragon" not in im:
                    src = re.search(r'src="([^"]*)"', im)
                    todo.append((rel, src.group(1) if src else "?"))

        # Landmarks and the skip link.
        body = re.sub(r'<body([^>]*)>', r'<body\1><a class="skip-link" href="#main-content">Skip to content</a>', body, count=1)
        body = re.sub(r'<div class="center( [^"]*)?">', lambda m: f'<div class="center{m.group(1) or ""}" id="main-content" role="main" tabindex="-1">', body, count=1)
        body = body.replace('<div class="left sidebar">', '<div class="left sidebar" role="complementary" aria-label="Sidebar">', 1)
        body = body.replace('<div class="search">', '<div class="search" role="search">', 1)
        body = body.replace('<div class="site-social-links">', '<div class="site-social-links" role="navigation" aria-label="Social links">', 1)
        body = body.replace('<p class="breadcrumb">', '<p class="breadcrumb" role="navigation" aria-label="Breadcrumb">', 1)
        body = re.sub(r'<div class="toc"', '<div class="toc" role="navigation" aria-label="On this page"', body, count=1)

        # Pages with no other navigation (the 404 and canvas pages) still get one, around the site name.
        if 'role="navigation"' not in body and "<nav" not in body:
            body = re.sub(r'(<header class="site-header">)(.*?)(</header>)',
                          r'\1<nav aria-label="Site" style="display:contents">\2</nav>\3', body, count=1, flags=re.S)

        # Quartz writes the sidebar titles and the listing titles as h3, and a listing
        # has no h2 above them. aria-level says what level they are without changing the look.
        body = body.replace('<div class="graph"><h3>', '<div class="graph"><h3 aria-level="2">')
        body = re.sub(r'(<div class="(?:toc|backlinks|recent-notes|explorer)[^"]*"[^>]*>\s*<h3)>', r'\1 aria-level="2">', body)
        body = body.replace('<div class="desc"><h3>', '<div class="desc"><h3 aria-level="2">')

        # The properties table is hidden by CSS; keep it out of the table landmarks.
        body = body.replace('<table class="note-properties-table"', '<table class="note-properties-table" role="presentation"')

        # Decorative icons.
        body = re.sub(r"<svg(?![^>]*\b(?:aria-hidden|aria-label|role)=)", '<svg aria-hidden="true" focusable="false"', body)

        # Names for task-list checkboxes.
        def checkbox(m):
            li_open, inp, rest = m.group(1), m.group(2), m.group(3)
            if "aria-label" in inp:
                return m.group(0)
            name = text_of(re.split(r"<[uo]l", rest)[0])[:120]
            if not name:
                return m.group(0)
            return f'{li_open}{inp.replace("<input", "<input aria-label=" + chr(34) + html.escape(name, quote=True) + chr(34), 1)}{rest}'
        body = re.sub(r'(<li[^>]*task-list-item[^>]*>)(<input type="checkbox"[^>]*/?>)(.*?(?=</li>|<ul|<ol))', checkbox, body, flags=re.S)

        # Links that open a new tab.
        def newtab(m):
            open_tag, inner = m.group(1), m.group(2)
            if "(opens in a new tab)" in inner or "opens in a new tab" in open_tag:
                return m.group(0)
            if 'aria-label="' in open_tag:
                return re.sub(r'aria-label="([^"]*)"', r'aria-label="\1 (opens in a new tab)"', open_tag, count=1) + inner + "</a>"
            return open_tag + inner + '<span class="visually-hidden"> (opens in a new tab)</span></a>'
        body = re.sub(r'(<a\b[^>]*\btarget="_blank"[^>]*>)(.*?)</a>', newtab, body, flags=re.S)

        # A page with no h1 gets a hidden one.
        if "<h1" not in body:
            ti = re.search(r"<title>(.*?)</title>", head, re.S)
            if ti:
                body = body.replace('id="main-content"', 'id="main-content"', 1)
                body = re.sub(r'(<div class="[^"]*" id="main-content"[^>]*>)', rf'\1<h1 class="visually-hidden">{ti.group(1)}</h1>', body, count=1)

        body = lang_greek(body)
        t = head + body
        if t != orig:
            open(path, "w", encoding="utf-8").write(t); changed += 1

with open("a11y-alt-todo.txt", "w") as out:
    out.write("Photos with no alt text. Write it in the note as ![[photo.jpg|what is in it]].\n")
    for rel, src in todo:
        out.write(f"{rel}\t{src}\n")
print(f"accessibility fixes on {changed} page(s); photos still needing alt text: {len(todo)} (a11y-alt-todo.txt)")
