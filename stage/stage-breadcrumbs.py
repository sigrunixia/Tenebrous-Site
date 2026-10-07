#!/usr/bin/env python3
"""Add a breadcrumb to staged notes that lack one.

A breadcrumb is a first body line of wikilinks joined by " / ". Hub notes carry
the pieces: their own breadcrumb starts with the home link and ends with the
hub's label (for example Home / Travel). A note whose `categories` names a hub
gets Home / <hub label> / <its own heading>, so the line can be dropped from the
note itself. Staged copies only. Run before stage-permalinks.py, while links
still use file names.
"""
import os, re, sys

stage = sys.argv[1]
crumb_re = re.compile(r"^\[\[[^\]]+\]\](?: / (?:\[\[[^\]]+\]\]|[^\[\]/\n]+))+\s*$")
link_re = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]")

def split(text):
    m = re.match(r"---\n(.*?)\n---\n?(.*)", text, re.S)
    return (m.group(1), m.group(2)) if m else (None, text)

notes = {}
for root, _, files in os.walk(stage):
    for f in files:
        if f.endswith(".md"):
            p = os.path.join(root, f)
            notes[p] = open(p, encoding="utf-8").read()

def first_line(body):
    for line in body.split("\n"):
        if line.strip():
            return line
    return ""

# Hub name -> (home link, label), read from each note's existing breadcrumb.
hubs, home = {}, None
for p, text in notes.items():
    fm, body = split(text)
    line = first_line(body)
    if fm is None or not crumb_re.match(line):
        continue
    links = link_re.findall(line)
    if len(links) == 2:  # Home / Hub
        home = home or "[[%s|%s]]" % (links[0][0], links[0][1] or links[0][0])
        hubs[links[1][0].strip()] = links[1][1] or links[1][0]

added = 0
for p, text in notes.items():
    fm, body = split(text)
    if fm is None or crumb_re.match(first_line(body)) or not home:
        continue
    cats = re.search(r"^categories:\s*\n((?:\s+-.*\n?)+)", fm, re.M)
    hub = next((link_re.search(c).group(1).strip()
                for c in (cats.group(1).split("\n") if cats else [])
                if link_re.search(c) and link_re.search(c).group(1).strip() in hubs), None)
    if not hub:
        continue
    name = os.path.splitext(os.path.basename(p))[0]
    h1 = re.search(r"^# (.+)$", body, re.M)
    title = h1.group(1).strip() if h1 else name
    crumb = "%s / [[%s|%s]] / [[%s|%s]]" % (home, hub, hubs[hub], name, title)
    open(p, "w", encoding="utf-8").write("---\n%s\n---\n\n%s\n\n%s" % (fm, crumb, body.lstrip("\n")))
    added += 1
print("breadcrumbs added to", added, "note(s)")
