// The facts box beside a note, built from its frontmatter. A trip, a project and any other note
// each get their own fields. Names link only when that note is on the site.
import { coverCard, slugOf, wikiTarget } from "./notes.ts";

type Data = Record<string, unknown>;
export type Names = Map<string, { url: string; title: string }>;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v ? [v] : []);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const asDate = (v: unknown) => (v instanceof Date && !isNaN(+v) ? v : undefined);
const dmy = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

function span(a: Date, b?: Date) {
  if (!b || +b === +a) return dmy(a);
  const [ay, am, ad, by, bm, bd] = [a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()];
  if (ay === by && am === bm) return `${ad} to ${bd} ${MONTHS[bm]} ${by}`;
  if (ay === by) return `${ad} ${MONTHS[am]} to ${bd} ${MONTHS[bm]} ${by}`;
  return `${dmy(a)} to ${dmy(b)}`;
}

function wiki(v: string, names: Names) {
  const m = v.trim().match(/^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]$/);
  if (!m) return { found: undefined, text: v.trim() };
  const found = names.get(m[1].trim().toLowerCase());
  return { found, text: (m[2] ?? m[1].split("/").pop()!).trim() };
}

function item(v: unknown, names: Names) {
  const { found, text } = wiki(String(v), names);
  return found ? `<a href="${found.url}" class="internal">${esc(text)}</a>` : `<span>${esc(text)}</span>`;
}

// Text with [[wikilinks]] in it: links to notes on the site, plain text otherwise.
function rich(v: string, names: Names) {
  return esc(v).replace(/\[\[[^\]]+\]\]/g, (m) => item(m.replace(/&amp;/g, "&"), names));
}

function source(u: string) {
  const url = new URL(u);
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/^\/|\/$/g, "");
  const label = host.endsWith("wikipedia.org") ? "Wikipedia" : host === "github.com" && path ? `${host}/${path}` : host;
  return `<a href="${esc(u)}" class="external" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

const STRUCTURAL = new Set(["hub", "categories", "topics"]);

function filedUnder(data: Data, names: Names, withTypes: boolean) {
  const pills: string[] = [];
  const seen = new Set<string>();
  for (const key of withTypes ? ["categories", "types"] : ["categories"]) {
    for (const v of list(data[key])) {
      const { found, text } = wiki(String(v), names);
      if (found && !seen.has(found.url)) {
        seen.add(found.url);
        pills.push(`<a href="${found.url}" class="internal">${esc(text)}</a>`);
      }
    }
  }
  return pills.join(", ");
}

export function buildInfobox(data: Data, names: Names, minutes: number, lessons = false): { html: string; label: string } | undefined {
  const classes = list(data.cssclasses).map(String);
  if (classes.some((c) => ["hub", "landing", "κόμβος"].includes(c))) return undefined;
  const trip = classes.includes("trip"), project = classes.includes("project");
  const rows: [string, string][] = [];
  const a = asDate(data.started), b = asDate(data.ended), m = asDate(data.modified);
  const updated = m ? `${dmy(m)} <span class="infobox-note">(${minutes} min read)</span>` : "";

  if (project) {
    if (updated) rows.push(["Updated", updated]);
    if (data.statuses) rows.push(["Status", esc(list(data.statuses).join(", "))]);
    if (data.role) rows.push(["Role", esc(String(list(data.role)[0]))]);
    if (a) rows.push(["Period", esc(b ? span(a, b) : `Since ${dmy(a)}`)]);
    else if (data.year) rows.push(["Year", esc(String(list(data.year)[0]))]);
    const who = [...list(data.people), ...list(data.organizations)];
    if (who.length) rows.push(["With", who.map((v) => item(v, names)).join(", ")]);
    if (data.platform) rows.push(["Works on", list(data.platform).map((v) => item(v, names)).join(", ")]);
    const links = list(data.sources).map(String).filter((u) => u.startsWith("http")).map(source);
    if (links.length) rows.push(["Links", links.join("<br>")]);
    const f = filedUnder(data, names, false);
    if (f) rows.push(["Filed under", f]);
  } else if (!trip) {
    if (updated) rows.push(["Updated", updated]);
    if (data.description) rows.push(["Summary", esc(String(list(data.description)[0]))]);
    if (data.use) rows.push(["Use", esc(String(list(data.use)[0]))]);
    if (data.platform) rows.push(["Works on", esc(list(data.platform).join(", "))]);
    const f = filedUnder(data, names, true);
    if (f) rows.push(["Filed under", f]);
  } else {
    if (updated) rows.push(["Updated", updated]);
    if (data.when) rows.push(["When", esc(String(list(data.when)[0]))]);
    else if (a) {
      const days = b && +b > +a ? ` <span class="infobox-note">(${Math.round((+b - +a) / 86400000) + 1} days)</span>` : "";
      rows.push(["Dates", esc(span(a, b)) + days]);
    }
    for (const [label, key] of [["Where", "locations"], ["Who", "people"], ["Type", "types"]]) {
      const vals = list(data[key]);
      if (vals.length) rows.push([label, vals.map((v) => item(v, names)).join(", ")]);
    }
    for (const [label, key] of [["Why", "why"], ["How", "how"], ["Stayed", "stayed"], ["Carried", "carried"]]) {
      const v = list(data[key])[0];
      if (v) rows.push([label, rich(String(v), names)]);
    }
    // A way to the lessons at the end of a long note.
    if (lessons) rows.push(["Lessons", '<a href="#lessons" class="internal">Read the lessons</a>']);
    const f = filedUnder(data, names, false);
    if (f) rows.push(["Filed under", f]);
  }

  const img = coverCard(data.cover);
  if (!rows.length && !img) return undefined;
  const alt = data["cover-alt"] ? esc(String(list(data["cover-alt"])[0])) : "";
  const credit = data["cover-credit"] && img ? `<p class="infobox-credit">${esc(String(list(data["cover-credit"])[0]))}</p>` : "";
  const dl = "<dl>" + rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("") + "</dl>";
  return {
    html: (img ? `<img src="${img}" alt="${alt}" loading="lazy">${credit}` : "") + dl,
    label: trip ? "Trip facts" : project ? "Project facts" : "Page details",
  };
}

export const nameKeys = (stem: string, data: Data) =>
  [stem, String(data.title ?? ""), ...list(data.aliases).map(String)].filter(Boolean).map((k) => k.toLowerCase());
export { slugOf, wikiTarget };
