import { titleOf } from "../lib/notes.ts";

// One page per tag written in a published note's frontmatter. Role tags and the status tags have no page.
const ROLE = new Set(["hub", "categories", "topics"]);

export const layout = "layout.vto";

export default function* ({ search }: Lume.Data) {
  const tags = new Map<string, Lume.Data[]>();
  for (const page of search.pages("publish=true")) {
    for (const t of [page.tags ?? []].flat().map((x: string) => String(x).replace(/^#/, ""))) {
      if (ROLE.has(t.toLowerCase())) continue;
      tags.set(t, [...(tags.get(t) ?? []), page]);
    }
  }
  for (const [tag, pages] of tags) {
    const cards = pages
      .map((p) => `<a href="${p.url}" class="bases-card"><div class="bases-card-body"><span class="bases-card-title">${titleOf(p, p.url)}</span></div></a>`)
      .join("");
    yield {
      url: `/tags/${tag.toLowerCase().replace(/ /g, "-")}/`,
      title: `Tag: ${tag}`,
      content: `<h1 class="article-title">Tag: ${tag}</h1><div class="bases-cards">${cards}</div>`,
    };
  }
}
