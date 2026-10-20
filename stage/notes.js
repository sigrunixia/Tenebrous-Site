// Two fixes to the staged copies of the notes. The vault is not touched.
//
// Tags are not frontmatter in the vault. Each note has a line of #tags near the top of its body, but the
// site reads tags from frontmatter, and a tag line in the page would print as visible text, so the staged
// copy puts them back where the site expects them.
//
// The Sigrunixia note lists email, CV and the social links as a block of contact cards, which suits
// Obsidian. On the site the same links sit in the sidebar, so the cards are only repeated and are left out.
//
// usage: deno run --allow-read --allow-write notes.js <stage dir>
import { join } from "jsr:@std/path@1";

const STAGE = Deno.realPathSync(Deno.args[0]);
const TAG_LINE = /^#[\p{L}\p{N}_/-]+(?: #[\p{L}\p{N}_/-]+)*$/u;

function eachNote(fn) {
  const walk = (dir) => {
    for (const e of Deno.readDirSync(dir)) {
      const p = join(dir, e.name);
      if (e.isDirectory) walk(p);
      else if (e.name.endsWith(".md")) fn(p, Deno.readTextFileSync(p).replace(/\r\n?/g, "\n"));
    }
  };
  walk(STAGE);
}

let moved = 0;
eachNote((p, text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  const fm = m ? m[1] : "";
  const body = m ? text.slice(m[0].length) : text;
  const tags = [], kept = [];
  let fence = false;
  for (const line of body.split("\n")) {
    if (line.startsWith("```") || line.startsWith("~~~")) fence = !fence;
    if (!fence && TAG_LINE.test(line.trim())) {
      tags.push(...line.trim().split(/\s+/).map((t) => t.slice(1)));
      continue;
    }
    kept.push(line);
  }
  if (!tags.length) return;
  const block = "tags:\n" + [...new Set(tags)].map((t) => `  - ${t}`).join("\n");
  Deno.writeTextFileSync(p, "---\n" + (fm ? fm + "\n" + block : block) + "\n---\n" + kept.join("\n").replace(/\n{3,}/g, "\n\n"));
  moved++;
});
console.log(`tag lines moved back to frontmatter in ${moved} staged note(s)`);

let removed = 0;
eachNote((p, text) => {
  const lines = text.split("\n"), out = [];
  let hit = false;
  for (let i = 0; i < lines.length;) {
    if (/^>\s*\[!contact\]/.test(lines[i])) {
      while (i < lines.length && lines[i].startsWith(">")) i++;
      hit = true;
      continue;
    }
    out.push(lines[i++]);
  }
  if (!hit) return;
  // The block sat between two rules, which would now be side by side.
  Deno.writeTextFileSync(p, out.join("\n").replace(/\n---\n\n+---\n/g, "\n---\n"));
  removed++;
});
console.log(`contact cards removed from ${removed} note(s)`);
