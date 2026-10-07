#!/usr/bin/env python3
"""Make each note's permalink its URL, in the staged copies only.

Quartz builds a page's URL from its file path and treats `permalink` as a
redirect alias. Obsidian Publish served the permalink itself. So for every
staged note with a permalink this script
  - moves the file to <permalink>.md at the stage root,
  - sets `title:` to the old file name, since Quartz titles pages from the path,
  - drops the permalink line and any alias that would collide with the new URL,
  - rewrites wikilinks in note bodies to point at the new path.
Frontmatter links are left alone, because Bases filters match on their text.
Aliases equal to a note's own URL are dropped for notes without a permalink too,
since Quartz would write a redirect page over the note.
"""
import json, os, re, sys

stage = sys.argv[1]

def slug(text):
    return re.sub(r"\s+", "-", text.strip().lower())

def split(text):
    m = re.match(r"---\n(.*?)\n---\n?(.*)", text, re.S)
    return (m.group(1), m.group(2)) if m else (None, text)

notes = {}
for root, _, files in os.walk(stage):
    for f in files:
        if f.endswith(".md"):
            p = os.path.join(root, f)
            notes[p] = open(p, encoding="utf-8").read()

# Old name (and old path) to permalink.
targets = {}
moves = {}
for p, text in notes.items():
    fm, body = split(text)
    m = fm and re.search(r"^permalink:\s*(\S+)\s*$", fm, re.M)
    if not m:
        continue
    perma = m.group(1).strip("\"'")
    if perma == "home":
        perma = "index"  # Quartz serves index as the site root, and so does its graph
    rel = os.path.relpath(p, stage)[:-3]
    name = os.path.basename(rel)
    moves[p] = (perma, name)
    targets[name.lower()] = (perma, name)
    targets[rel.lower()] = (perma, name)

link = re.compile(r"(!?)\[\[([^\]|#]+)(#[^\]|]*)?(\|[^\]]*)?\]\]")

def rewrite_links(body):
    # In a table row the pipe that starts the display text has to be escaped, or it ends the cell.
    def sub(m, bar):
        bang, target, heading, alias = m.groups()
        hit = targets.get(target.strip().lower())
        if not hit:
            return m.group(0)
        perma, name = hit
        if alias:
            shown = alias
        elif heading:
            shown = bar + name + " > " + heading[1:]
        else:
            shown = bar + name
        return "%s[[%s%s%s]]" % (bang, perma, heading or "", shown)
    out = []
    for line in body.split("\n"):
        bar = "\\|" if line.lstrip().startswith("|") else "|"
        out.append(link.sub(lambda m: sub(m, bar), line))
    return "\n".join(out)

def clean_aliases(fm, own):
    out, in_aliases = [], False
    for line in fm.split("\n"):
        if re.match(r"^aliases:\s*$", line):
            in_aliases = True
        elif in_aliases and not re.match(r"^\s*-\s", line):
            in_aliases = False
        item = re.match(r"^\s*-\s*[\"']?(.+?)[\"']?\s*$", line) if in_aliases else None
        if item and slug(item.group(1)) == own:
            continue
        out.append(line)
    return "\n".join(out)

for p, text in notes.items():
    fm, body = split(text)
    if fm is None:
        continue
    if p in moves:
        perma, name = moves[p]
        fm = re.sub(r"^permalink:.*\n?", "", fm, flags=re.M).rstrip("\n")
        if not re.search(r"^title:", fm, re.M):
            fm += "\ntitle: " + json.dumps(name, ensure_ascii=False)
        own = perma
        dest = os.path.join(stage, perma + ".md")
    else:
        own = slug(os.path.relpath(p, stage)[:-3])
        dest = p
    fm = clean_aliases(fm, own)
    new = "---\n%s\n---\n%s" % (fm, rewrite_links(body))
    if dest != p:
        os.remove(p)
    open(dest, "w", encoding="utf-8").write(new)
