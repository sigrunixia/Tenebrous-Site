#!/usr/bin/env python3
"""Rewrite Bases filters and formulas the plugin cannot evaluate, in staged
copies only.

- list.contains(this.file.name) becomes list.join(",").contains("<this note's
  name>"). The plugin compares list items as raw text, and a link is stored as
  "[[Name]]", so an exact match never hits.
- A link list shown on a card (locations, people, types, categories) becomes a
  formula that strips the [[ ]]. A link inside a card, which is itself a link,
  is not valid HTML, and the parser splits the card into pieces. The names show
  as plain text instead.
- (today() - date).days <op> N becomes a comparison of the date against the
  cutoff date, fixed at build time, since the plugin has no date arithmetic.

usage: stage-bases.py <stage dir>
"""
import datetime, os, re, sys

stage = sys.argv[1]
today = datetime.date.today()
flip = {"<=": ">=", "<": ">", ">=": "<=", ">": "<"}

def note_name(path, text):
    m = re.search(r'^title:\s*"?(.+?)"?\s*$', text.split("\n---\n", 1)[0], re.M)
    return m.group(1) if m else os.path.splitext(os.path.basename(path))[0]

LINK_LISTS = ("locations", "people", "types", "categories")
STRIP = '.join(", ").replace("[[", "").replace("]]", "")'

def unlink_cards(block):
    """Within a base, replace link lists in card views with plain-text formulas."""
    if "type: cards" not in block:
        return block
    parts = re.split(r"(?m)^(?=  - type:)", block)
    used = []
    for i, part in enumerate(parts):
        if not part.lstrip().startswith("- type: cards"):
            continue
        def sub(m):
            used.append(m.group(2))
            return "%sformula.%s_text" % (m.group(1), m.group(2))
        parts[i] = re.sub(r"(?m)^(\s+- )(%s)\s*$" % "|".join(LINK_LISTS), sub, part)
    block = "".join(parts)
    if not used:
        return block
    used = sorted(set(used))
    formulas = "".join("  %s_text: %s%s\n" % (n, n, STRIP) for n in used)
    props = "".join("  formula.%s_text:\n    displayName: %s\n" % (n, label(block, n)) for n in used)
    if re.search(r"(?m)^formulas:\n", block):
        block = re.sub(r"(?m)^formulas:\n", "formulas:\n" + formulas, block, count=1)
    else:
        block = re.sub(r"(?m)^(properties:|views:)", lambda m: "formulas:\n" + formulas + m.group(1), block, count=1)
    if re.search(r"(?m)^properties:\n", block):
        block = re.sub(r"(?m)^properties:\n", "properties:\n" + props, block, count=1)
    else:
        block = re.sub(r"(?m)^views:", lambda m: "properties:\n" + props + "views:", block, count=1)
    return block

def label(block, name):
    m = re.search(r"(?m)^  note\.%s:\n    displayName: (.+)$" % name, block)
    return m.group(1).strip() if m else name.capitalize()

def rewrite(text, name):
    text = re.sub(r"\b(\w+)\.contains\(this\.file\.name\)",
                  lambda m: '%s.join(",").contains("%s")' % (m.group(1), name.replace('"', '\\"')), text)
    def days(m):
        date, op, n = m.group(1), m.group(2), int(m.group(3))
        cutoff = (today - datetime.timedelta(days=n)).isoformat()
        return '%s.toString() %s "%s"' % (date, flip[op], cutoff)
    text = re.sub(r"\(today\(\)\s*-\s*(\w+)\)\.days\s*(<=|<|>=|>)\s*(\d+)", days, text)
    # fenced base blocks in notes, and whole .base files
    text = re.sub(r"(?s)(```base\n)(.*?)(\n```)", lambda m: m.group(1) + unlink_cards(m.group(2)) + m.group(3), text)
    return text

changed = 0
for root, _, files in os.walk(stage):
    for f in files:
        if not f.endswith((".md", ".base")):
            continue
        p = os.path.join(root, f)
        text = open(p, encoding="utf-8").read()
        if f.endswith(".base"):
            new = unlink_cards(text)
        else:
            new = rewrite(text, note_name(p, text))
        if new != text:
            open(p, "w", encoding="utf-8").write(new)
            changed += 1
print("Bases filters rewritten in", changed, "note(s)")
