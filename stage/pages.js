// Writes the pages the site makes for itself into the staged notes: a page per place, a page per type
// and category, and the Site map that lists them. Staged copies only; the vault is not touched.
//
// The place notes in the vault are not published, so a trip's Where has nowhere to link. Each place page
// is a Bases card list of the trips whose `locations` name the place. A note's `types` and `categories`
// link to notes that are not published (Road trip, Flight), so each of those gets a card list of the
// published notes that name it. A target that is already published is left alone.
//
// usage: deno run --allow-read --allow-write pages.js <stage dir> <vault dir>
import { join } from "jsr:@std/path@1";

const STAGE = Deno.realPathSync(Deno.args[0]);
const VAULT = Deno.args[1];
const STRUCTURAL = new Set(["hub", "categories", "topics"]); // tags that only mark a page's role
const HUB = new Set(["κόμβος", "hub"]);
const ascii = (s) => /^[\x00-\x7f]*$/.test(s);
const unquote = (s) => s.trim().replace(/^["']+|["']+$/g, "");
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

// The frontmatter as lists of strings. Some notes have invalid YAML, so this reads the lines instead of parsing it.
function fmOf(text) {
  const out = {};
  let key = null;
  for (const line of (text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "").split("\n")) {
    const k = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (k) { key = k[1]; const v = unquote(k[2]); out[key] = v === "" ? [] : [v]; }
    else if (key && /^\s+-\s/.test(line)) (out[key] ??= []).push(unquote(line.replace(/^\s+-\s*/, "")));
  }
  return out;
}

// [[Target#Heading|Shown]] as [target, shown].
function link(v) {
  const m = v.trim().match(/^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]$/);
  return m ? [m[1].trim(), (m[2] ?? m[1]).trim()] : [null, null];
}

// Every staged note as [path relative to the stage, file name, frontmatter], read fresh so a step sees the pages before it.
function staged() {
  const out = [];
  const walk = (dir) => {
    for (const e of [...Deno.readDirSync(dir)].sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory) walk(join(dir, e.name));
      else if (e.name.endsWith(".md")) out.push([join(dir, e.name).slice(STAGE.length + 1), e.name, fmOf(Deno.readTextFileSync(join(dir, e.name)))]);
    }
  };
  walk(STAGE);
  return out;
}

// What the site already has a page for, by file name, title and alias.
function publishedNames(notes) {
  const names = new Set();
  for (const [, file, fm] of notes) for (const n of [file.replace(/\.md$/, ""), ...(fm.title ?? []), ...(fm.aliases ?? [])]) names.add(n.toLowerCase());
  return names;
}

// Names in order of how often they were seen, the first seen winning a tie.
const byCount = (counts) => [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name);
const count = (counts, name) => counts.set(name, (counts.get(name) ?? 0) + 1);
const aliasLines = (aliases) => aliases.map((a) => `  - "${a}"`).join("\n");
const fileName = (s) => s.replace(/[\\/:*?"<>|]/g, "");

function write(path, body) {
  Deno.mkdirSync(join(path, ".."), { recursive: true });
  Deno.writeTextFileSync(path, body);
}

// The aliases of the vault notes with these names, since the place notes are not published.
function vaultAliases(names) {
  const want = new Set(names.map((n) => n.toLowerCase()));
  const found = {};
  const walk = (dir) => {
    for (const e of Deno.readDirSync(dir)) {
      if (e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory) walk(p);
      else if (e.name.endsWith(".md") && want.has(e.name.slice(0, -3).toLowerCase())) found[e.name.slice(0, -3).toLowerCase()] = fmOf(Deno.readTextFileSync(p)).aliases ?? [];
    }
  };
  walk(VAULT);
  return found;
}

function places() {
  const notes = staged();
  const published = publishedNames(notes);
  const trips = notes.map((n) => n[2]).filter((fm) => (fm.cssclasses ?? []).includes("trip"));
  const found = new Map(); // target -> counts of the names it was shown as
  let hub = null;
  for (const fm of trips) {
    if (!hub && fm.categories?.length) hub = link(fm.categories[0])[0];
    for (const v of fm.locations ?? []) {
      const [target, shown] = link(v);
      if (target) count(found.get(target) ?? found.set(target, new Map()).get(target), shown);
    }
  }
  if (!hub) { console.error("stage pages: no trip category found, nothing written"); Deno.exit(1); }
  const greek = [...found.keys()].filter((t) => !ascii(t));
  const extra = greek.length ? vaultAliases(greek) : {};
  let made = 0;
  for (const [target, counts] of found) {
    if (published.has(target.toLowerCase())) continue;
    const shown = byCount(counts);
    let title = shown[0];
    let english = null;
    if (!ascii(target)) {
      // A Greek name is shown with its English one, "Greek - English", the way the hub headings are.
      // The English comes from a display text, else a vault alias.
      english = shown.find(ascii) ?? (extra[target.toLowerCase()] ?? []).find(ascii) ?? null;
      if (english) title = `${target} - ${english}`;
    }
    const aliases = [target, ...shown.filter((s) => s !== target && s !== title)];
    if (english && !aliases.includes(english)) aliases.push(english);
    write(join(STAGE, "places", fileName(english || title) + ".md"), `---
title: "${title}"
created: ${today}
modified: ${today}
aliases:
${aliasLines(aliases)}
publish: true
cssclasses:
  - κόμβος
---
[[index|Home]] / [[travel|Travel]] / ${title}

# ${title}

The trips I have taken to ${title}, newest first.

\`\`\`base
filters:
  and:
    - categories.join(",").contains("${hub}")
    - locations.join(",").contains("${target}")
properties:
  note.started:
    displayName: Start
  note.ended:
    displayName: End
  file.name:
    displayName: Trip
views:
  - type: cards
    name: Trips
    order:
      - file.name
      - started
      - ended
    sort:
      - property: started
        direction: DESC
    image: note.cover
\`\`\`
`);
    made++;
  }
  console.log(`place pages written: ${made}`);
}

function types() {
  const notes = staged();
  const published = publishedNames(notes);
  const targets = new Map(); // target -> the names it was shown as, the fields it was named in, and whether each note was a trip
  for (const [, , fm] of notes) {
    for (const field of ["types", "categories"]) {
      for (const v of fm[field] ?? []) {
        const [target, shown] = link(v);
        if (!target || published.has(target.toLowerCase())) continue;
        const t = targets.get(target) ?? targets.set(target, { shown: new Map(), fields: new Set(), trips: [] }).get(target);
        count(t.shown, shown);
        t.fields.add(field);
        t.trips.push((fm.cssclasses ?? []).includes("trip"));
      }
    }
  }
  let made = 0;
  for (const [target, t] of targets) {
    const shown = byCount(t.shown);
    const title = shown[0];
    const aliases = [target, ...shown.filter((s) => s !== target && s !== title)];
    const conds = [...t.fields].sort().map((f) => `${f}.join(",").contains("${target}")`);
    const filter = conds.length === 1 ? `  and:\n    - ${conds[0]}` : "  or:\n" + conds.map((c) => `    - ${c}`).join("\n");
    const trips = t.trips.every(Boolean);
    const cols = trips ? ["file.name", "started", "ended"] : ["file.name", "modified"];
    const props = trips
      ? "  note.started:\n    displayName: Start\n  note.ended:\n    displayName: End\n  file.name:\n    displayName: Trip"
      : "  note.modified:\n    displayName: Updated\n  file.name:\n    displayName: Note";
    write(join(STAGE, "types", fileName(title) + ".md"), `---
title: "${title}"
created: ${today}
modified: ${today}
aliases:
${aliasLines(aliases)}
publish: true
cssclasses:
  - κόμβος
---
[[index|Home]] / [[site-map|Site map]] / ${title}

# ${title}

Everything filed under ${title}, newest first.

\`\`\`base
filters:
${filter}
properties:
${props}
views:
  - type: cards
    name: ${title}
    order:
${cols.map((c) => `      - ${c}`).join("\n")}
    sort:
      - property: ${trips ? "started" : "modified"}
        direction: DESC
    image: note.cover
\`\`\`
`);
    made++;
  }
  console.log(`type pages written: ${made}`);
}

// The Site map, an index of every way into the site: the hubs, the kinds, the places and the tags.
function siteMap() {
  // The title, or its first plain-ASCII alias when the title is in Greek (Travel, not Τα ταξίδια).
  const titleOf = (file, fm) => {
    const title = (fm.title ?? [file.replace(/\.md$/, "")])[0];
    return ascii(title) ? title : (fm.aliases ?? []).find(ascii) ?? title;
  };
  const hubs = [], kinds = [], places = [], tags = new Set();
  for (const [rel, file, fm] of staged()) {
    const name = file.replace(/\.md$/, "");
    const isHub = (fm.cssclasses ?? []).some((c) => HUB.has(c));
    const entry = [isHub && !rel.startsWith("places") && !rel.startsWith("types") ? titleOf(file, fm) : (fm.title ?? [name])[0], name];
    for (const t of fm.tags ?? []) if (!STRUCTURAL.has(t.toLowerCase())) tags.add(t);
    if (rel.startsWith("types/")) kinds.push(entry);
    else if (rel.startsWith("places/")) places.push(entry);
    else if (isHub && rel !== "index.md" && rel !== "site-map.md") hubs.push(entry);
  }
  const list = (items) => items.sort((a, b) => (a[0].toLowerCase() < b[0].toLowerCase() ? -1 : a[0].toLowerCase() > b[0].toLowerCase() ? 1 : 0))
    .map(([t, n]) => `- [[${n}|${t}]]`).join("\n") + "\n";
  let out = `---
title: Site map
created: ${today}
modified: ${today}
publish: true
cssclasses:
  - κόμβος
---
[[index|Home]] / Site map

# Site map

You can also use the search bar.

## Hubs

The main parts of the site.

${list(hubs)}
## Kinds

What the notes are, such as a road trip or a flight.

${list(kinds)}
## Places

Where I have been.

${list(places)}
`;
  if (tags.size) out += "\n## Tags\n\n" + [...tags].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1)).map((t) => `- [${t}](/tags/${t.toLowerCase().replaceAll(" ", "-")})`).join("\n") + "\n";
  write(join(STAGE, "site-map.md"), out);
  console.log(`site map page written: ${hubs.length} hubs, ${kinds.length} kinds, ${places.length} places, ${tags.size} tags`);
}

places();
types();
siteMap();
