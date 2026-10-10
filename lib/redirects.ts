// The old addresses of every page, written as Cloudflare's _redirects file. An address changes when the
// slugifier writes it differently from the old site (a comma becomes a hyphen, .canvas becomes -canvas),
// and an alias of a note (its other names, in the note's frontmatter) used to be a redirect page of its own.

// The address Quartz gave a note: lower case, spaces to hyphens, a few characters spelled out, commas kept.
export function quartzSlug(path: string) {
  return path.split("/").map((p) =>
    p.toLowerCase().replace(/ /g, "-").replace(/&/g, "-and-").replace(/%/g, "-percent").replace(/\?/g, "-q").replace(/#/g, "-h")
      .replace(/-+/g, "-").replace(/^-|-$/g, "")
  ).join("/");
}

type Entry = { path: string; url: string; aliases: string[] };

export function redirects(entries: Entry[], carried: string[]) {
  const lines = new Map<string, string>();
  const kept = new Set(carried.map((l) => l.split(/\s+/)[0]));
  const taken = new Set(entries.map((e) => decodeURI(e.url).replace(/\/$/, "")));
  const add = (from: string, to: string, status = 301) => {
    const f = from.startsWith("/") ? from : `/${from}`;
    if (f === "/" || taken.has(f) || lines.has(f) || kept.has(f) || kept.has(encodeURI(f))) return;
    lines.set(f, `${f} ${to} ${status}`);
    const encoded = encodeURI(f);
    if (encoded !== f && !lines.has(encoded)) lines.set(encoded, `${encoded} ${to} ${status}`);
  };
  for (const e of entries) {
    const base = e.path.replace(/\.(md|canvas)$/, "");
    const old = e.path.endsWith(".canvas") ? `${quartzSlug(base)}.canvas` : quartzSlug(base).replace(/\/index$/, "");
    add(old, e.url);
    for (const a of e.aliases) add(quartzSlug(a), e.url);
  }
  const rules = [...lines.values()];
  // The hand-kept ones come first, so they win over a generated rule for the same address.
  return [...carried, ...rules].join("\n") + "\n";
}
