#!/usr/bin/env python3
"""A scripted accessibility audit of the built pages (no network, standard library).

Covers what a script can see: language, titles, landmarks, headings, images,
links, controls, ids, tables and ARIA. It cannot judge reading order, whether
alt text is good, or what a screen reader says; those are a manual pass.

usage: a11y-audit.py public [--detail]
"""
import collections, os, re, sys
from html.parser import HTMLParser

PUBLIC = sys.argv[1] if len(sys.argv) > 1 else "public"
DETAIL = "--detail" in sys.argv
GREEK = re.compile(r"[Ͱ-Ͽἀ-῿]")
VOID = {"img", "br", "hr", "input", "meta", "link", "source", "area", "base", "col", "embed", "wbr", "path", "circle", "rect", "line", "polyline", "polygon", "use"}

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []; self.lang = None; self.title = ""; self.in_title = False
        self.landmarks = collections.Counter(); self.headings = []; self.imgs = []
        self.links = []; self.buttons = []; self.inputs = []; self.ids = collections.Counter()
        self.tables = 0; self.th = 0; self.iframes = []; self.tabindex_pos = 0
        self.greek_no_lang = 0; self.skip = False; self.cur_link = None; self.cur_btn = None
        self.cur_h = None; self.labels_for = set(); self.svgs_unhidden = 0; self.meta_refresh = False

    def lang_here(self):
        for t, a in reversed(self.stack):
            if a.get("lang"):
                return a["lang"]
        return self.lang

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "meta" and (a.get("http-equiv") or "").lower() == "refresh":
            self.meta_refresh = True
        if tag == "title":
            self.in_title = True
        if "id" in a:
            self.ids[a["id"]] += 1
        if tag in ("header", "nav", "main", "footer", "aside", "article", "form"):
            self.landmarks[tag] += 1
        if a.get("role") in ("banner", "navigation", "main", "contentinfo", "complementary", "search", "region"):
            self.landmarks["role=" + a["role"]] += 1
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.cur_h = [int(a.get("aria-level") or tag[1]), ""]
        if tag == "img":
            self.imgs.append((a.get("alt"), a.get("src", ""), a.get("aria-hidden"), a.get("role")))
        if tag == "a":
            self.cur_link = {"href": a.get("href", ""), "text": "", "label": a.get("aria-label") or a.get("title"), "blank": a.get("target") == "_blank", "cls": a.get("class", ""), "imgalt": "", "hidden": a.get("aria-hidden") == "true"}
        if tag == "button":
            self.cur_btn = {"text": "", "label": a.get("aria-label") or a.get("title")}
        if tag == "input" and a.get("type") not in ("hidden",):
            self.inputs.append((a.get("type", "text"), a.get("id"), a.get("aria-label") or a.get("placeholder") and None or a.get("aria-label"), a.get("title"), a.get("placeholder")))
        if tag == "label" and a.get("for"):
            self.labels_for.add(a["for"])
        if tag == "table" and a.get("role") != "presentation":
            self.tables += 1
        if tag == "th":
            self.th += 1
        if tag == "iframe":
            self.iframes.append(a.get("title"))
        if a.get("tabindex") and a["tabindex"].lstrip("-").isdigit() and int(a["tabindex"]) > 0:
            self.tabindex_pos += 1
        if tag == "svg" and a.get("aria-hidden") != "true" and not a.get("aria-label") and not a.get("role"):
            self.svgs_unhidden += 1
        if tag in ("script", "style"):
            self.skip = True
        if tag == "img" and self.cur_link is not None:
            self.cur_link["imgalt"] = a.get("alt") or ""
        if tag not in VOID:
            self.stack.append((tag, a))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag in ("script", "style"):
            self.skip = False
        if tag == "a" and self.cur_link is not None:
            self.links.append(self.cur_link); self.cur_link = None
        if tag == "button" and self.cur_btn is not None:
            self.buttons.append(self.cur_btn); self.cur_btn = None
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self.cur_h:
            self.headings.append(tuple(self.cur_h)); self.cur_h = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]; break

    def handle_data(self, data):
        if self.skip:
            return
        if self.in_title:
            self.title += data
        if self.cur_link is not None:
            self.cur_link["text"] += data
        if self.cur_btn is not None:
            self.cur_btn["text"] += data
        if self.cur_h:
            self.cur_h[1] += data
        if GREEK.search(data) and not self.in_title:
            lg = self.lang_here() or ""
            if not lg.lower().startswith("el"):
                self.greek_no_lang += 1

issues = collections.defaultdict(list)
pages = 0
titles = collections.defaultdict(list)
for root, _, files in os.walk(PUBLIC):
    for f in sorted(files):
        if not f.endswith(".html"):
            continue
        path = os.path.join(root, f); rel = os.path.relpath(path, PUBLIC)
        p = Page(); p.feed(open(path, encoding="utf-8").read())
        if p.meta_refresh:
            continue   # a redirect page
        pages += 1
        titles[p.title.strip()].append(rel)
        def add(kind, detail=""):
            issues[kind].append((rel, detail))
        if not p.lang: add("html has no lang attribute")
        if not p.title.strip(): add("page has no title")
        for lm in ("main",):
            if not p.landmarks[lm] and not p.landmarks["role=main"]: add("no main landmark")
        if not p.landmarks["nav"] and not p.landmarks["role=navigation"]: add("no nav landmark")
        if not p.landmarks["header"] and not p.landmarks["role=banner"]: add("no header (banner) landmark")
        if not p.landmarks["footer"] and not p.landmarks["role=contentinfo"]: add("no footer (contentinfo) landmark")
        h1 = [h for h in p.headings if h[0] == 1]
        if len(h1) != 1: add(f"{len(h1)} h1 elements (want exactly one)")
        last = 0
        for lvl, txt in p.headings:
            if last and lvl > last + 1:
                add("heading level skipped", f"h{last} to h{lvl}: {txt.strip()[:40]}"); 
            if not txt.strip(): add("empty heading")
            last = lvl
        for alt, src, hid, role in p.imgs:
            if alt is None: add("image with no alt attribute", src)
            elif alt.strip() == "" and "tenebrous-dragon" not in src and hid != "true" and role not in ("presentation", "none"): add("image with empty alt (fine only if decorative)", src)
        for l in p.links:
            if l["hidden"]: continue
            name = (l["text"].strip() or l["imgalt"].strip() or (l["label"] or "").strip())
            if not name: add("link with no accessible name", l["href"])
            elif name.lower() in ("click here", "here", "link", "read more", "more", "visit", "this"): add("vague link text", f"{name} -> {l['href']}")
            if l["blank"] and "opens in a new tab" not in (l["text"] + (l["label"] or "")): add("link opens a new tab without being marked", l["href"])
        for b in p.buttons:
            if not (b["text"].strip() or (b["label"] or "").strip()): add("button with no accessible name")
        for t, i, aria, title, ph in p.inputs:
            if not (aria or title or (i and i in p.labels_for)):
                add("form control with no label", f"{t} (placeholder only: {ph})" if ph else t)
        for k, n in p.ids.items():
            if n > 1: add("duplicate id", k)
        if p.tables and not p.th: add("table with no header cells")
        for t in p.iframes:
            if not t: add("iframe with no title")
        if p.tabindex_pos: add("positive tabindex (breaks tab order)")
        if p.greek_no_lang: add("Greek text not marked lang=el", f"{p.greek_no_lang} text runs")
        if p.svgs_unhidden: add("svg not hidden from assistive tech", f"{p.svgs_unhidden}")
for t, rels in titles.items():
    if len(rels) > 1 and t:
        issues["duplicate page title"].append((", ".join(rels[:3]), t))
print(f"{pages} pages audited\n")
for kind, items in sorted(issues.items(), key=lambda kv: -len(kv[1])):
    pgs = len({r for r, _ in items})
    print(f"{len(items):5}  {kind}  ({pgs} page{'s' if pgs != 1 else ''})")
    for rel, d in items[: (8 if DETAIL else 2)]:
        print(f"         {rel}  {d}")
if not issues:
    print("no issues found")
