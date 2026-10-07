#!/usr/bin/env python3
"""Add the group headings the Bases plugin leaves out.

The plugin ignores `groupBy`. For every inline base block in a staged note whose
view has `groupBy`, find the matching rendered card view and insert a heading
before the first card of each group. The group key is the first date in the
card (its year), which matches the Year formulas the trip bases use. Cards are
already sorted by the base, so groups stay contiguous.

usage: bases-groups.py <public dir> <stage dir>
"""
import os, re, sys

public, stage = sys.argv[1], sys.argv[2]

def slug(rel):
    return re.sub(r"\s+", "-", rel.lower())

def key_fn(block, view):
    """A function from a card's first date to its group heading, or None when the
    view has no groupBy. Handles the two formulas the vault uses: a year
    (`x.year`) and a recency split (`if(x.toString() >= "date", "A", "B")`)."""
    if "groupBy:" not in view:
        return None
    prop = re.search(r"groupBy:\s*\n\s*property:\s*formula\.(\w+)", view)
    expr = ""
    if prop:
        m = re.search(r"^\s*%s:\s*(.+)$" % re.escape(prop.group(1)), block, re.M)
        expr = m.group(1) if m else ""
    recency = re.search(r'if\(\w+\.toString\(\)\s*(>=|<=|>|<)\s*"(\d{4}-\d{2}-\d{2})",\s*"([^"]+)",\s*"([^"]+)"\)', expr)
    if recency:
        op, cutoff, yes, no = recency.groups()
        cmp = {">=": lambda d: d >= cutoff, "<=": lambda d: d <= cutoff,
               ">": lambda d: d > cutoff, "<": lambda d: d < cutoff}[op]
        return lambda date: yes if cmp(date) else no
    return lambda date: date[:4]

def grouped_views(md):
    """For each ```base block, a list with one entry per view: a key function
    or None."""
    out = []
    for block in re.findall(r"```base\n(.*?)```", md, re.S):
        views = re.split(r"^\s*-\s*type:", block, flags=re.M)[1:]
        out.append([key_fn(block, v) for v in views])
    return out

view_re = re.compile(r'(<div class="bases-view[^"]*" data-view-index="(\d+)" data-view-type="cards">)(.*?)(?=<div class="bases-view[ "]|$)', re.S)
card_re = re.compile(r'<a [^>]*class="[^"]*bases-card[^"]*"[^>]*>.*?</a>', re.S)

def add_headings(html_view, key_for, level=2):
    cards = list(card_re.finditer(html_view))
    if not cards:
        return html_view
    out, last, pos = [], None, 0
    for m in cards:
        date = re.search(r'bases-text">(\d{4}-\d{2}-\d{2})', m.group(0))
        key = key_for(date.group(1)) if date else None
        out.append(html_view[pos:m.start()])
        if key and key != last:
            out.append('<h%d class="bases-group-heading">%s</h%d>' % (level + 1, key, level + 1))
            last = key
        pos = m.start()
    out.append(html_view[pos:])
    return "".join(out)

changed = 0
for root, _, files in os.walk(stage):
    for f in files:
        if not f.endswith(".md"):
            continue
        p = os.path.join(root, f)
        flags = grouped_views(open(p, encoding="utf-8").read())
        if not any(any(v) for v in flags):
            continue
        rel = os.path.relpath(p, stage)[:-3]
        target = os.path.join(public, slug(rel) + ".html")
        if not os.path.exists(target):
            print("no page for", rel, file=sys.stderr)
            continue
        html = open(target, encoding="utf-8").read()
        parts = re.split(r'(<div class="bases-page bases-inline">)', html)
        # parts: text, marker, chunk, marker, chunk ...
        for i, flag in enumerate(flags):
            idx = 2 + 2 * i
            if idx >= len(parts):
                break
            chunk = parts[idx]
            before = re.findall(r"<h([1-6])[ >]", "".join(parts[:idx]))
            level = min(5, int(before[-1])) if before else 1
            def fix(m):
                j = int(m.group(2))
                if j < len(flag) and flag[j]:
                    return m.group(1) + add_headings(m.group(3), flag[j], level)
                return m.group(0)
            parts[idx] = view_re.sub(fix, chunk)
        new = "".join(parts)
        if new != html:
            open(target, "w", encoding="utf-8").write(new)
            changed += 1
print("group headings added on", changed, "page(s)")
