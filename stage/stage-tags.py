#!/usr/bin/env python3
"""Move the tag lines in the staged notes back into frontmatter.

In the vault, tags are not frontmatter. Each note has one line of #tags near the top of its body.
Quartz reads tags from frontmatter, and prints a tag line in the page as visible text, so the
staged copy puts them back where Quartz expects them. The vault is not touched.

usage: stage-tags.py <stage dir>
"""
import os, re, sys

STAGE = sys.argv[1]
TAG_LINE = re.compile(r"#[\w/-]+(?: #[\w/-]+)*")

moved = 0
for root, _, files in os.walk(STAGE):
    for f in files:
        if not f.endswith(".md"):
            continue
        p = os.path.join(root, f)
        text = open(p, encoding="utf-8").read()
        m = re.match(r"---\n(.*?)\n---\n", text, re.S)
        fm, body = (m.group(1), text[m.end():]) if m else ("", text)
        tags, kept, fence = [], [], False
        for line in body.split("\n"):
            if line.startswith(("```", "~~~")):
                fence = not fence
            if not fence and TAG_LINE.fullmatch(line.strip()):
                tags += [t[1:] for t in line.split()]
                continue
            kept.append(line)
        if not tags:
            continue
        body = re.sub(r"\n{3,}", "\n\n", "\n".join(kept))
        block = "tags:\n" + "\n".join(f"  - {t}" for t in dict.fromkeys(tags))
        fm = (fm + "\n" + block) if fm else block
        open(p, "w", encoding="utf-8").write("---\n" + fm + "\n---\n" + body)
        moved += 1
print(f"tag lines moved back to frontmatter in {moved} staged note(s)")
