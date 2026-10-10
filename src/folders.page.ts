import { titleOf } from "../lib/notes.ts";

// A listing for each folder of notes that has no index note of its own (places, types, the trips folder).
export const layout = "layout.vto";

export default function* ({ search }: Lume.Data) {
  const pages = search.pages("publish=true");
  const folders = new Map<string, Lume.Data[]>();
  for (const p of pages) {
    const parts = decodeURI(String(p.url)).split("/").filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      const dir = "/" + parts.slice(0, i).join("/") + "/";
      folders.set(dir, [...(folders.get(dir) ?? []), p]);
    }
  }
  const have = new Set(pages.map((p) => decodeURI(String(p.url))));
  for (const [dir, list] of folders) {
    if (have.has(dir) || dir.startsWith("/tags/")) continue;
    const name = decodeURIComponent(dir.split("/").filter(Boolean).pop()!);
    const title = name[0].toUpperCase() + name.slice(1);
    const direct = list.filter((p) => decodeURI(String(p.url)).split("/").filter(Boolean).length === dir.split("/").filter(Boolean).length + 1);
    const cards = direct.sort((a, b) => titleOf(a, a.url).localeCompare(titleOf(b, b.url)))
      .map((p) => `<a href="${p.url}" class="bases-card"><div class="bases-card-body"><span class="bases-card-title">${titleOf(p, p.url)}</span></div></a>`).join("");
    const trail = dir.split("/").filter(Boolean).map((seg, i, all) => {
      const d = "/" + all.slice(0, i + 1).join("/") + "/";
      const label = decodeURIComponent(seg)[0].toUpperCase() + decodeURIComponent(seg).slice(1);
      return folders.has(d) && !d.startsWith("/tags/") ? `<a href="${d}">${label}</a>` : label;
    });
    const crumbs = `<p><a href="/">Home</a> / ${trail.join(" / ")}</p>`;
    yield { url: dir, title, content: `${crumbs}<h1 class="article-title">${title}</h1><div class="bases-cards">${cards}</div>` };
  }
}
