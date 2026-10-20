// Fixes to the staged copies of the notes. The vault is not touched.
//
// Tags are not frontmatter in the vault. Each note has a line of #tags near the top of its body, but the
// site reads tags from frontmatter, and a tag line in the page would print as visible text, so the staged
// copy puts them back where the site expects them.
//
// The Sigrunixia note lists email, CV and the social links as a block of contact cards, which suits
// Obsidian. On the site the same links sit in the sidebar, so the cards are only repeated and are left out.
//
// The build makes a page's URL from its file path, and Obsidian Publish served the permalink itself. So
// for every staged note with a permalink the file moves to <permalink>.md at the stage root, `title:` is
// set to the old file name so the page keeps its title, the permalink line and any alias that matches the
// new URL are dropped, and wikilinks in note bodies are rewritten to point at the new path. Frontmatter
// links are left alone, because Bases filters match on their text. An alias that matches its own note's
// URL is no use as a redirect, so it is dropped from notes without a permalink too.
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

const slug = (text) => text.trim().toLowerCase().replace(/\s+/g, "-");
const split = (text) => text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

// Every staged note, the files of a folder before its folders.
const notes = new Map();
const collect = (dir) => {
  const entries = [...Deno.readDirSync(dir)];
  for (const e of entries) if (!e.isDirectory && e.name.endsWith(".md")) notes.set(join(dir, e.name), Deno.readTextFileSync(join(dir, e.name)).replace(/\r\n?/g, "\n"));
  for (const e of entries) if (e.isDirectory) collect(join(dir, e.name));
};
collect(STAGE);

// A note's old name and old path, each to its permalink.
const targets = new Map(), moves = new Map();
for (const [p, text] of notes) {
  const fm = split(text)?.[1];
  const m = fm && fm.match(/^permalink:\s*(\S+)\s*$/m);
  if (!m) continue;
  let perma = m[1].replace(/^["']+|["']+$/g, "");
  if (perma === "home") perma = "index"; // index is the site root
  const rel = p.slice(STAGE.length + 1, -3);
  const name = rel.split("/").pop();
  moves.set(p, [perma, name]);
  targets.set(name.toLowerCase(), [perma, name]);
  targets.set(rel.toLowerCase(), [perma, name]);
}

// In a table row the pipe that starts the display text has to be escaped, or it ends the cell.
const rewriteLinks = (body) => body.split("\n").map((line) => {
  const bar = line.trimStart().startsWith("|") ? "\\|" : "|";
  return line.replace(/(!?)\[\[([^\]|#]+)(#[^\]|]*)?(\|[^\]]*)?\]\]/g, (all, bang, target, heading, alias) => {
    const hit = targets.get(target.trim().toLowerCase());
    if (!hit) return all;
    const [perma, name] = hit;
    const shown = alias ? alias : heading ? bar + name + " > " + heading.slice(1) : bar + name;
    return `${bang}[[${perma}${heading ?? ""}${shown}]]`;
  });
}).join("\n");

const cleanAliases = (fm, own) => {
  let inAliases = false;
  return fm.split("\n").filter((line) => {
    if (/^aliases:\s*$/.test(line)) inAliases = true;
    else if (inAliases && !/^\s*-\s/.test(line)) inAliases = false;
    const item = inAliases && line.match(/^\s*-\s*["']?(.+?)["']?\s*$/);
    return !(item && slug(item[1]) === own);
  }).join("\n");
};

for (const [p, text] of notes) {
  const m = split(text);
  if (!m) continue;
  let fm = m[1], dest = p, own;
  if (moves.has(p)) {
    const [perma, name] = moves.get(p);
    fm = fm.replace(/^permalink:.*\n?/gm, "").replace(/\n+$/, "");
    if (!/^title:/m.test(fm)) fm += "\ntitle: " + JSON.stringify(name);
    own = perma;
    dest = join(STAGE, perma + ".md");
  } else own = slug(p.slice(STAGE.length + 1, -3));
  const out = "---\n" + cleanAliases(fm, own) + "\n---\n" + rewriteLinks(m[2]);
  if (dest !== p) Deno.removeSync(p);
  Deno.mkdirSync(join(dest, ".."), { recursive: true });
  Deno.writeTextFileSync(dest, out);
}
console.log(`permalinks applied to ${moves.size} staged note(s)`);
