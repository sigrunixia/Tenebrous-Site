import lume from "lume/mod.ts";
import { Page } from "lume/core/file.ts";
import feed from "lume/plugins/feed.ts";
import robots from "lume/plugins/robots.ts";
import slugifyUrls from "lume/plugins/slugify_urls.ts";
import checkUrls from "lume/plugins/check_urls.ts";
import sitemap from "lume/plugins/sitemap.ts";
import { renderBase, type MapPayload, type Note, type Resolve } from "./lib/bases.ts";
import { headingId, noteUrl, slugOf, titleOf } from "./lib/notes.ts";
import { embeds, footnotes, markTasks, outsideCode, tasks } from "./lib/markdown.ts";
import { redirects } from "./lib/redirects.ts";
import { externalLinks, greekLang, uniqueIds } from "./lib/polish.ts";
import { renderCanvas, slug as canvasSlug } from "./lib/canvas.ts";
import { buildInfobox, nameKeys, type Names } from "./lib/infobox.ts";
import places from "./places.json" with { type: "json" };

const canvasUrls: string[] = [];
for (const dir of [...Deno.readDirSync("src")].filter((e) => e.name === "notes")) {
  const walk = (p: string) => { for (const e of Deno.readDirSync(p)) { if (e.isDirectory) walk(`${p}/${e.name}`); else if (e.name.endsWith(".canvas")) canvasUrls.push("/" + `${p}/${e.name}`.replace(/^src\/notes\//, "").replace(/\.canvas$/, "").split("/").map(slugOf).join("/") + "-canvas/"); } };
  walk(`src/${dir.name}`);
}
const site = lume({ src: "./src", location: new URL("https://tenebrousdragon.com") });

site.add("static");
site.add("img");
site.add("site.css");
site.add("root/favicon.ico", "favicon.ico");

// Canvases: each .canvas file becomes a page at the address Quartz gave it (the folders and the .canvas ending kept).
site.loadPages([".canvas"], {
  loader: async (path: string) => {
    const name = path.split("/src/notes/")[1].replace(/\.canvas$/, "");
    const title = name.split("/").pop()!;
    const json = JSON.parse(await Deno.readTextFile(path));
    return {
      title,
      layout: "canvas.vto",
      publish: true,
      url: "/" + name.split("/").map(slugOf).join("/") + "-canvas/",
      content: renderCanvas(json, title),
    };
  },
});

site.use(slugifyUrls({ alphanumeric: false }));
// The slugifier writes addresses percent-encoded; the pages and folders on disk keep the real letters.
site.preprocess([".html"], (pages) => {
  for (const page of pages) page.data.url = decodeURI(page.data.url);
});
site.use(sitemap());
site.use(robots({ allow: "*", sitemap: "https://tenebrousdragon.com/sitemap.xml" }));
site.use(feed({
  output: "/index.xml",
  query: "publish=true",
  sort: "date=desc",
  limit: 30,
  info: { title: "Tenebrous Dragon", description: "Notes from the Tenebrous Dragon vault", lang: "en" },
  items: { title: "=title", description: "=description", published: "=date" },
}));

const marks: Record<string, string> = {
  "🔴": "red", "🟥": "red", "❤️": "red", "🟠": "orange", "🟧": "orange", "🧡": "orange",
  "🟡": "yellow", "🟨": "yellow", "💛": "yellow", "🟢": "green", "🟩": "green", "💚": "green",
  "🔵": "blue", "🟦": "blue", "💙": "blue", "🟣": "purple", "🟪": "purple", "💜": "purple",
  "🩵": "cyan", "🩷": "pink", "🤎": "brown", "🤍": "silver",
};

// Notes arrive from the staging step with wikilinks already written as [[permalink|Name]].
// A base block becomes the cards (or the map) it describes, built from every note's frontmatter.
site.preprocess([".md"], (pages) => {
  const notes: Note[] = pages.map((p) => ({ path: p.src.path + ".md", data: p.data }));
  // asFile(): a link names a place note in the vault (icon, colour), or a note on the site.
  const byName = new Map<string, Record<string, unknown>>();
  for (const p of pages) for (const k of nameKeys(p.src.path.split("/").pop()!, p.data)) if (!byName.has(k)) byName.set(k, p.data);
  const resolve: Resolve = (link) => {
    const target = link.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim().toLowerCase();
    return (places as Record<string, Record<string, unknown>>)[target] ?? byName.get(target);
  };
  const map = (payload: MapPayload) =>
    `<div class="base-map-embed" data-map="${JSON.stringify(payload).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" role="region" aria-label="Map of the trips"></div>`;
  const context = { resolve, map };
  const known = new Set(pages.map((p) => noteUrl(p.src.path)));
  const canvases = new Map(canvasUrls.map((u) => [u.split("/").filter(Boolean).pop()!.replace(/\/$/, ""), u]));
  const link = (target: string, name: string) => {
    const [note, heading] = target.split("#");
    if (note.endsWith(".canvas")) {
      const u = canvases.get(slugOf(note.split("/").pop()!.replace(/\.canvas$/, "")) + "-canvas");
      return u ? `[${name}](${u})` : `<span class="unresolved" title="No page on the site">${name}</span>`;
    }
    const anchor = heading ? `#${headingId(heading)}` : "";
    if (!note) return `[${name}](${anchor})`;
    if (note !== "index" && !known.has(noteUrl(note))) return `<span class="unresolved" title="No page on the site">${name}</span>`;
    return `[${name}](${note === "index" ? "/" : noteUrl(note)}${anchor})`;
  };
  for (const page of pages) {
    let c = page.data.content as string;
    if (typeof c !== "string") continue;
    c = outsideCode(c, (text) => tasks(footnotes(embeds(text))));
    c = c.replace(/```base\n([\s\S]*?)```/g, (_, src) => `\n\n${renderBase(src, notes, context)}\n\n`);
    // [[target|Name]] links to a published note, or to a heading in one. A note that is not on the site stays plain text.
    c = c.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, name) => link(target, name));
    c = c.replace(/\[\[([^\]|]+)\]\]/g, (_, target) => link(target, target.replace(/^#/, "")));
    c = c.replace(/==(.+?)==/g, (all, text) => {
      const hue = marks[[...text.trim()][0]] ?? "yellow";
      return `<mark class="text-highlight hl-${hue}">${text}</mark>`;
    });
    page.data.content = c;
  }
});

// Obsidian callouts: a blockquote whose first line is [!type] Title, written out with the markup Obsidian and the theme CSS expect.
site.process([".html"], (pages) => {
  for (const page of pages) {
    const doc = page.document;
    if (!doc) continue;
    for (const bq of [...doc.querySelectorAll("blockquote")].reverse()) {
      const first = bq.querySelector("p");
      const m = first?.innerHTML.match(/^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)\n?/);
      if (!first || !m) continue;
      const kind = m[1];
      const title = m[3] || kind[0].toUpperCase() + kind.slice(1);
      const rest = first.innerHTML.slice(m[0].length).trim();
      if (rest) first.innerHTML = rest; else first.remove();
      const inner = bq.innerHTML;
      const fold = m[2];
      bq.className = `callout ${kind}${fold ? " is-collapsible" : ""}${fold === "-" ? " is-collapsed" : ""}`;
      bq.setAttribute("data-callout", kind);
      bq.innerHTML = `<div class="callout-title"><div class="callout-icon"></div><div class="callout-title-inner"><p>${title}</p></div>${fold ? '<div class="fold-callout-icon"></div>' : ""}</div><div class="callout-content">${inner}</div>`;
    }
  }
});

// A page whose note has no heading of its own gets its title as one.
site.process([".html"], (pages) => {
  for (const page of pages) {
    const doc = page.document;
    const art = doc?.querySelector("article");
    if (!doc || !art || art.querySelector("h1") ) continue;
    const h1 = `<h1 class="article-title">${titleOf(page.data, page.src.path)}</h1>`;
    const crumb = art.innerHTML.match(/^\s*<p><a href="\/">Home<\/a>.*?<\/p>/s);
    art.innerHTML = crumb ? crumb[0] + h1 + art.innerHTML.slice(crumb[0].length) : h1 + art.innerHTML;
  }
});

// The facts box, in the right sidebar and again after the title for narrow screens.
let names: Names = new Map();
site.preprocess([".md"], (pages) => {
  for (const p of pages) {
    const stem = p.src.path.split("/").pop()!;
    const entry = { url: noteUrl(p.src.path), title: titleOf(p.data, p.src.path) };
    for (const k of nameKeys(stem, p.data)) if (!names.has(k)) names.set(k, entry);
  }
});
site.process([".html"], (pages) => {
  for (const page of pages) {
    const doc = page.document;
    const art = doc?.querySelector("article");
    const side = doc?.querySelector(".sidebar.right");
    if (!doc || !art || !side) continue;
    const words = (art.textContent ?? "").split(/\s+/).length;
    const box = buildInfobox(page.data, names, Math.max(1, Math.round(words / 200)), [...art.querySelectorAll("h2")].some((h) => headingId(h.textContent) === "lessons"));
    if (!box) continue;
    const make = (where: string) => `<aside class="infobox infobox-${where}" aria-label="${box.label}">${box.html}</aside>`;
    side.innerHTML = make("side");
    const h1 = art.querySelector("h1");
    if (h1) h1.outerHTML = h1.outerHTML + make("inline");
  }
});

// Task lists: the classes the theme styles checkboxes by.
site.process([".html"], (pages) => {
  for (const page of pages) if (page.document) markTasks(page.document);
});

// Every heading gets an id, so a link can reach it.
site.process([".html"], (pages) => {
  for (const page of pages) if (page.document) uniqueIds(page.document, headingId);
});

// Links to a heading use the id the heading gets, whatever capitals and spaces the note wrote.
site.process([".html"], (pages) => {
  for (const page of pages) {
    for (const a of page.document?.querySelectorAll('a[href*="#"]') ?? []) {
      const href = a.getAttribute("href")!;
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [path, frag] = href.split("#");
      a.setAttribute("href", `${path}#${headingId(decodeURIComponent(frag))}`);
    }
  }
});

// A table of contents from the h2 and h3 headings of a page with three or more. It goes in the left sidebar
// on wide screens, and as a collapsed list after the title on narrow ones.
const plainText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
site.process([".html"], (pages) => {
  for (const page of pages) {
    const doc = page.document;
    const side = doc?.querySelector(".sidebar.left");
    const art = doc?.querySelector("article");
    const heads = [...(doc?.querySelectorAll("article h2:not(.bases-group-heading), article h3") ?? [])];
    if (!doc || !side || !art || heads.length < 3) continue;
    const items = heads.map((h) => {
      const id = h.id || headingId(h.textContent);
      h.id = id;
      return `<li class="depth-${h.tagName.slice(1)}"><a href="#${id}">${plainText(h.textContent.trim())}</a></li>`;
    }).join("");
    side.innerHTML += `<nav class="toc" aria-label="On this page"><h2>On this page</h2><ul>${items}</ul></nav>`;
    const short = `<details class="page-outline-mobile"><summary>On this page</summary><nav aria-label="On this page, short list"><ul>${items}</ul></nav></details>`;
    const after = art.querySelector(".infobox-inline") ?? art.querySelector("h1");
    if (after) after.outerHTML = after.outerHTML + short;
  }
});

// The search index: each page's title, description and the start of its text. Search fetches it when first opened.
const entries: { u: string; t: string; d: string; x: string }[] = [];
site.process([".html"], (pages) => {
  entries.length = 0;
  for (const page of pages) {
    const art = page.document?.querySelector("article");
    if (!art || !page.data.url || page.data.url.startsWith("/tags/") || !page.data.publish) continue;
    const text = (art.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 3000);
    entries.push({ u: page.data.url, t: titleOf(page.data, page.src.path), d: String(page.data.description ?? ""), x: text });
  }
});
site.addEventListener("beforeSave", () => {
  site.pages.push(Page.create({ url: "/static/search-index.json", content: JSON.stringify(entries) }));
});

// External links, then the Greek marks, last so they see the final markup.
site.process([".html"], (pages) => {
  for (const page of pages) {
    const doc = page.document;
    if (!doc) continue;
    externalLinks(doc, "tenebrousdragon.com");
    doc.body.innerHTML = greekLang(doc.body.innerHTML);
  }
});

site.use(checkUrls({ output: "_broken-links.json" }));

// _redirects, for Cloudflare: the hand-kept rules plus an old address for every note that moved or has aliases.
site.addEventListener("afterBuild", async () => {
  const carried = (await Deno.readTextFile("src/root/cf-redirects")).split("\n").filter((l) => l.trim());
  const entries = site.pages
    .filter((p) => p.data.url && p.src.path && p.data.publish)
    .map((p) => ({
      path: p.src.path.replace(/^\/notes\//, "") + (p.src.ext ?? ""),
      url: p.data.url as string,
      aliases: [p.data.aliases ?? []].flat().map(String),
    }));
  await Deno.writeTextFile(site.dest("_redirects"), redirects(entries, carried));
});

export default site;
