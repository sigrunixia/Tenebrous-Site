#!/usr/bin/env python3
"""Drop the contact-card callout from the staged notes.

The Sigrunixia note lists email, CV and the social links as a block of contact
cards, which suits Obsidian. On the site the same links sit in the sidebar, so the
cards are only repeated. The vault note is not touched.

usage: stage-contact.py <stage dir>
"""
import os, re, sys

stage = sys.argv[1]
n = 0
for root, _, files in os.walk(stage):
    for f in files:
        if not f.endswith(".md"):
            continue
        p = os.path.join(root, f)
        lines = open(p, encoding="utf-8").read().split("\n")
        out, i, hit = [], 0, False
        while i < len(lines):
            if re.match(r"^>\s*\[!contact\]", lines[i]):
                while i < len(lines) and lines[i].startswith(">"):
                    i += 1
                hit = True
                continue
            out.append(lines[i])
            i += 1
        if hit:
            # The block sat between two rules, which would now be side by side.
            text = re.sub(r"\n---\n\n+---\n", "\n---\n", "\n".join(out))
            open(p, "w", encoding="utf-8").write(text)
            n += 1
print(f"contact cards removed from {n} note(s)")
