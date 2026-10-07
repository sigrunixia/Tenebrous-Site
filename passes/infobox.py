#!/usr/bin/env python3
"""Add an infobox to every note, built from its frontmatter.

Every page except the hubs and the generated pages gets one, in two copies: in the
right sidebar (shown on wide screens) and after the title (shown on narrower ones).
A trip gets the fields below. Any other note gets Updated, Filed under (categories,
types and tags, each linking to its page) and its description.

A note with the cssclass "project" gets Updated, Status (statuses), Role, Period (started
and ended, or year), With (people and organizations), Works on (platform), Links (the
URLs in sources) and Filed under.

The trip fields are

Fields: dates (with the length in days), where, who and type from frontmatter,
then the Why, How, Stayed, With and Carried properties (or, for notes not converted
yet, the same lines from the note's own "Trip" callout). Sources are not shown. The
callout is removed from the page, since the infobox replaces it: its cover and
When line are covered by the cover thumbnail and the dates, and its Where line by
the Where of the frontmatter. A name links only when that note is published;
otherwise it is plain text, in the callout lines too.

usage: infobox.py public .stage
"""
import datetime, html, os, re, sys
from urllib.parse import urlparse

PUBLIC, STAGE = sys.argv[1], sys.argv[2]

def slug(rel):
    """Quartz's slug: lower case, spaces to hyphens, a few characters spelled out.
    Letters in any script and commas stay (a Greek name keeps its Greek)."""
    def one(p):
        p = p.lower().replace(" ", "-").replace("&", "-and-").replace("%", "-percent").replace("?", "-q").replace("#", "-h")
        return re.sub(r"-+", "-", p).strip("-")
    return "/".join(one(p) for p in rel.split("/"))

def frontmatter(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    out, key = {}, None
    for line in (m.group(1).split("\n") if m else []):
        k = re.match(r"^([A-Za-z_\-]+):\s*(.*)$", line)
        if k:
            key = k.group(1)
            v = k.group(2).strip().strip("\"'")
            out[key] = [] if v == "" else v
        elif key and re.match(r"^\s+-\s", line):
            if not isinstance(out[key], list):
                out[key] = [out[key]]
            out[key].append(re.sub(r"^\s+-\s*", "", line).strip().strip("\"'"))
    return out

# Index of published notes: names, titles and aliases -> built page slug.
notes, names, titles = [], {}, {}
for root, _, files in os.walk(STAGE):
    for f in files:
        if f.endswith(".md"):
            p = os.path.join(root, f)
            rel = os.path.relpath(p, STAGE)[:-3]
            raw = open(p, encoding="utf-8").read()
            fm = frontmatter(raw)
            fm["_body"] = raw.split("\n---\n", 1)[-1]
            s = "" if rel == "index" else slug(rel)
            if s and not os.path.exists(os.path.join(PUBLIC, s + ".html")):
                continue
            notes.append((rel, s, fm))
            if fm.get("title"):
                titles[s] = fm["title"] if isinstance(fm["title"], str) else fm["title"][0]
            keys = [os.path.basename(rel), fm.get("title", "")] + (fm.get("aliases") if isinstance(fm.get("aliases"), list) else [fm.get("aliases", "")])
            for k in keys:
                if k:
                    names.setdefault(k.lower(), s)

# Images by slugified file name, so a cover can be found from its wikilink.
images = {}
for root, _, files in os.walk(PUBLIC):
    for f in files:
        if f.lower().endswith((".webp", ".jpg", ".jpeg", ".png")):
            images.setdefault(f.lower(), os.path.relpath(os.path.join(root, f), PUBLIC))

def wikilink(v):
    m = re.match(r"^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]$", v.strip())
    return (m.group(1).strip(), (m.group(2) or os.path.basename(m.group(1))).strip()) if m else (None, v.strip())

def item(v):
    target, text = wikilink(v)
    s = names.get(target.lower()) if target else None
    # A Greek name links to a place page titled "Greek - English", so show both.
    if s and s.startswith("places/") and not text.isascii() and not titles.get(s, text).isascii():
        text = titles[s]
    e = html.escape(text)
    if s:
        return f'<a href="/{s}" class="internal">{e}</a>'
    return f"<span>{e}</span>"

def rich(v):
    """Text with [[wikilinks]]: links to published notes, plain text otherwise."""
    out, pos = [], 0
    for m in re.finditer(r"\[\[[^\]]+\]\]", v):
        out.append(html.escape(v[pos:m.start()]))
        out.append(item(m.group(0)))
        pos = m.end()
    out.append(html.escape(v[pos:]))
    return "".join(out)

# Properties that carry what the hand-written Trip callout used to say.
NARRATIVE = (("Why", "why"), ("How", "how"), ("Stayed", "stayed"), ("Carried", "carried"))

def as_list(v):
    return v if isinstance(v, list) else ([v] if v else [])

def date(v):
    try:
        return datetime.date.fromisoformat(str(v)[:10])
    except ValueError:
        return None

def dates(a, b):
    if not a:
        return ""
    if not b or b == a:
        return f"{a.day} {a:%B %Y}"
    if (a.year, a.month) == (b.year, b.month):
        return f"{a.day} to {b.day} {b:%B %Y}"
    if a.year == b.year:
        return f"{a.day} {a:%B} to {b.day} {b:%B %Y}"
    return f"{a.day} {a:%B %Y} to {b.day} {b:%B %Y}"

def source(u):
    host = urlparse(u).netloc.removeprefix("www.")
    path = urlparse(u).path.strip("/")
    label = "Wikipedia" if host.endswith("wikipedia.org") else (f"{host}/{path}" if host == "github.com" and path else host)
    return f'<a href="{html.escape(u, quote=True)}" class="external" target="_blank" rel="noopener noreferrer">{html.escape(label)}</a>'

def thumb(cover):
    target, _ = wikilink(cover or "")
    if not target:
        return None
    stem, ext = os.path.splitext(os.path.basename(target))
    base = slug(stem)
    return images.get(base + ".card.webp") or images.get(slug(os.path.basename(target)))

def plain(inner):
    """Links to unpublished notes (marked unresolved) become plain text."""
    return re.sub(r'<span class="unresolved"[^>]*>(.*?)</span>', r"\1", inner, flags=re.S)

META = re.compile(r'<p show-comma="true" class="content-meta">.*?</p>', re.S)
CALLOUT = re.compile(r'<blockquote class="callout trip"[^>]*>.*?</blockquote>\s*', re.S)
LINE = re.compile(r"<li>\s*<strong>(.*?)</strong>\s*(.*?)</li>", re.S)
DERIVED = {"when", "where"}   # already in the infobox from frontmatter

done = 0
STRUCTURAL = {"hub", "categories", "topics"}

def filed_under(fm, with_types):
    pills, seen = [], set()
    for key in ("categories", "types") if with_types else ("categories",):
        for v in as_list(fm.get(key)):
            target, text = wikilink(v)
            dest = names.get((target or "").lower())
            if dest and dest not in seen:
                seen.add(dest)
                pills.append(f'<a href="/{dest}" class="internal">{html.escape(text)}</a>')
    for t in as_list(fm.get("tags")):
        t = t.strip("#")
        d = "tags/" + t.lower().replace(" ", "-")
        if t.lower() not in STRUCTURAL and os.path.exists(os.path.join(PUBLIC, d + ".html")):
            pills.append(f'<a href="/{d}" class="internal">{html.escape(t)}</a>')
    return ", ".join(pills)

SKIP = {"κόμβος", "hub", "landing"}
done = 0
for rel, s, fm in notes:
    if not s or rel.startswith(("places/", "types/")) or rel == "site-map" or set(as_list(fm.get("cssclasses"))) & SKIP:
        continue
    trip = "trip" in as_list(fm.get("cssclasses"))
    project = "project" in as_list(fm.get("cssclasses"))
    path = os.path.join(PUBLIC, s + ".html")
    text = open(path, encoding="utf-8").read()
    callout = CALLOUT.search(text) if trip else None
    own = []
    if callout:
        own = [(html.unescape(re.sub(r"<[^>]+>", "", k)).strip(), plain(v.strip()))
               for k, v in LINE.findall(callout.group(0)) if re.sub(r"<[^>]+>", "", k).strip().lower() not in DERIVED]
    a, b = date(fm.get("started")), date(fm.get("ended"))
    rows = []
    # The date and reading time line above the title is folded into the Updated row.
    meta = META.search(text)
    mins = re.search(r"(\d+) min read", meta.group(0)) if meta else None
    m = date(fm.get("modified"))
    updated = ""
    if m:
        updated = html.escape(f"{m.day} {m:%B %Y}")
        if mins:
            updated += f' <span class="infobox-note">({mins.group(1)} min read)</span>'
    if project:
        # Status, role, period, who, platform and links, from frontmatter.
        if updated:
            rows.append(("Updated", updated))
        if fm.get("statuses"):
            rows.append(("Status", html.escape(", ".join(as_list(fm["statuses"])))))
        if fm.get("role"):
            rows.append(("Role", html.escape(as_list(fm["role"])[0])))
        if a:
            rows.append(("Period", html.escape(dates(a, b) if b else f"Since {a.day} {a:%B %Y}")))
        elif fm.get("year"):
            rows.append(("Year", html.escape(str(as_list(fm["year"])[0]))))
        with_ = as_list(fm.get("people")) + as_list(fm.get("organizations"))
        if with_:
            rows.append(("With", ", ".join(item(v) for v in with_)))
        if fm.get("platform"):
            rows.append(("Works on", ", ".join(item(str(x)) for x in as_list(fm["platform"]))))
        links = [source(u) for u in as_list(fm.get("sources")) if u.startswith("http")]
        if links:
            rows.append(("Links", "<br>".join(links)))
        f = filed_under(fm, False)
        if f:
            rows.append(("Filed under", f))
    elif not trip:
        if updated:
            rows.append(("Updated", updated))
        if fm.get("description"):
            rows.append(("Summary", html.escape(as_list(fm.get("description"))[0])))
        if fm.get("use"):
            rows.append(("Use", html.escape(str(as_list(fm.get("use"))[0]))))
        if fm.get("platform"):
            rows.append(("Works on", html.escape(", ".join(str(x) for x in as_list(fm.get("platform"))))))
        f = filed_under(fm, True)
        if f:
            rows.append(("Filed under", f))
    if trip and updated:
        rows.append(("Updated", updated))
    if trip and fm.get("when"):
        # A plain-text `when` stands in for the dates (a trip with no fixed dates yet).
        rows.append(("When", html.escape(as_list(fm["when"])[0])))
    elif a and trip:
        span = dates(a, b)
        days = f' <span class="infobox-note">({(b - a).days + 1} days)</span>' if b and b > a else ""
        rows.append(("Dates", html.escape(span) + days))
    if trip:
        for label, key in (("Where", "locations"), ("Who", "people"), ("Type", "types")):
            vals = as_list(fm.get(key))
            if vals:
                rows.append((label, ", ".join(item(v) for v in vals)))
        narrative = [(label, rich(as_list(fm.get(key))[0])) for label, key in NARRATIVE if as_list(fm.get(key))]
        # Properties win; the callout is only read for notes not converted yet.
        rows += narrative or own
        # A way to the lessons at the end of a long note.
        if re.search(r'<h2 id="lessons"', text):
            rows.append(("Lessons", '<a href="#lessons" class="internal">Read the lessons</a>'))
        f = filed_under(fm, False)
        if f:
            rows.append(("Filed under", f))
    img = thumb(fm.get("cover"))
    # A project's body can carry its cover as ![[image|cover - description]], which shows the
    # cover in Obsidian. On the site the infobox shows it instead, with that description.
    cover_alt = ""
    if project:
        ce = re.search(r'<p>\s*<img[^>]*?alt="cover - ([^"]*)"[^>]*>\s*</p>|<img[^>]*?alt="cover - ([^"]*)"[^>]*>', text)
        if ce:
            cover_alt = ce.group(1) or ce.group(2)
            text = text.replace(ce.group(0), "", 1)
    if not rows and not img:
        continue
    # A photo credit under the cover. The text comes from `cover-credit`, and the words
    # "Wikimedia Commons" link to the file page named in `sources`, if there is one.
    credit = ""
    if fm.get("cover-credit") and img:
        text_ = html.escape(as_list(fm["cover-credit"])[0])
        src = next((u for u in as_list(fm.get("sources")) if "commons.wikimedia.org/wiki/File:" in u), None)
        if src:
            text_ = text_.replace("Wikimedia Commons", f'<a href="{html.escape(src, quote=True)}" class="external" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>')
        credit = f'<p class="infobox-credit">{text_}</p>'

    def box(where):
        b = f'<aside class="infobox infobox-{where}" aria-label="{"Trip facts" if trip else "Project facts" if project else "Page details"}">'
        if img:
            b += f'<img src="/{img}" alt="{cover_alt}" loading="lazy">' + credit
        return b + "<dl>" + "".join(f"<div><dt>{html.escape(k)}</dt><dd>{v}</dd></div>" for k, v in rows) + "</dl></aside>"
    # After the first heading of the note, and in the right sidebar. The callout it replaces comes out.
    text, n = re.subn(r"(</h1>)", lambda m: m.group(1) + box("inline"), text, count=1)
    if not n:
        continue
    text = text.replace('<div class="right sidebar"></div>', '<div class="right sidebar">' + box("side") + "</div>", 1)
    text = CALLOUT.sub("", text, count=1)
    text = META.sub("", text, count=1)
    open(path, "w", encoding="utf-8").write(text)
    done += 1
print(f"infoboxes added: {done}")
