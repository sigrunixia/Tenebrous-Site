// Place notes in the vault are not published, but their icon and colour decide the map markers. Their
// properties go in places.json by every name a trip might use, and each icon is fetched once from Lucide.
//
// usage: deno run --allow-read --allow-write --allow-net place-data.js <vault dir>
// Run it from the repository root, which is where it writes.
import { join } from "jsr:@std/path@1";

const dir = join(Deno.args[0], "Reference/Places");
const unquote = (s) => s.trim().replace(/^["']+|["']+$/g, "");
const places = {}, icons = new Set();

for (const e of [...Deno.readDirSync(dir)].filter((e) => e.name.endsWith(".md"))) {
  const text = Deno.readTextFileSync(join(dir, e.name)).replace(/\r\n?/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) continue;
  // Some notes have invalid YAML, so this reads the lines instead of parsing it.
  const props = {};
  let key = null;
  for (const line of m[1].split("\n")) {
    const k = line.match(/^([A-Za-z_-]+):[ \t]*(.*)$/);
    if (k) { key = k[1]; const v = unquote(k[2]); props[key] = v === "" ? [] : v; }
    else if (key && /^\s+-\s/.test(line)) {
      if (!Array.isArray(props[key])) props[key] = props[key] ? [props[key]] : [];
      props[key].push(unquote(line.replace(/^\s+-\s*/, "")));
    }
  }
  for (const name of [e.name.slice(0, -3), ...(props.aliases ?? [])]) places[name.toLowerCase()] ??= props;
  if (typeof props.icon === "string") icons.add(props.icon);
}
Deno.writeTextFileSync("places.json", JSON.stringify(places));

Deno.mkdirSync("src/static/lucide", { recursive: true });
for (const icon of [...icons].sort()) {
  const dest = `src/static/lucide/${icon}.svg`;
  try { Deno.statSync(dest); continue; } catch { /* not fetched yet */ }
  const res = await fetch(`https://unpkg.com/lucide-static/icons/${icon}.svg`);
  if (res.ok) Deno.writeTextFileSync(dest, await res.text());
  else console.error(`no Lucide icon '${icon}'`);
}
console.log(`${Object.keys(places).length} place names, ${icons.size} icons`);
