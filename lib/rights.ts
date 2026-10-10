// Who made the work, under what licence, and how to credit it, in the forms people and machines read.
export const SITE = "https://tenebrousdragon.com";
export const LICENCE_NAME = "CC BY-NC-SA 4.0";
export const LICENCE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
export const POLICY_URL = `${SITE}/works/`;
export const AUTHOR = "Rebbecca Bishop (Sigrunixia)";

const day = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : undefined);

// Structured data for a page. Escaped so a title cannot close the script tag.
export function jsonLd(data: Record<string, unknown>) {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: String(data.title ?? ""),
    url: SITE + data.url,
    inLanguage: "en-GB",
    author: { "@type": "Person", name: AUTHOR, url: `${SITE}/sigrunixia/` },
    copyrightHolder: { "@type": "Person", name: AUTHOR },
    license: LICENCE_URL,
    isPartOf: { "@type": "WebSite", name: "A Tenebrous Dragon", url: SITE },
  };
  const made = day(data.created), changed = day(data.modified);
  if (made) { ld.datePublished = made; ld.copyrightYear = Number(made.slice(0, 4)); }
  if (changed) ld.dateModified = changed;
  if (data.description) ld.description = String(data.description);
  return JSON.stringify(ld).replace(/</g, "\\u003c");
}

// Cloudflare adds its own managed block above this (training crawlers disallowed, search=yes, ai-train=no).
// This adds what it leaves out, that assistants may fetch a page to answer a question and cite it.
export const robotsTxt = `User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference
Allow: /
`;

// Cloudflare reads this file and adds the headers to every response.
export const headersFile = `/*
  tdm-reservation: 1
  tdm-policy: ${POLICY_URL}
`;

// The TDM Reservation Protocol file, for crawlers that look here instead of the header.
export const tdmrepFile = JSON.stringify([{ location: "/", "tdm-reservation": 1, "tdm-policy": POLICY_URL }], null, 2) + "\n";

type Page = { url: string; title: string; description: string };

// llms.txt, as llmstxt.org describes it: a short note on the site, then a list of its pages.
export function llmsTxt(pages: Page[]) {
  const list = pages
    .sort((a, b) => a.title.localeCompare(b.title, "en"))
    .map((p) => `- [${p.title}](${SITE}${p.url})${p.description ? `: ${p.description}` : ""}`)
    .join("\n");
  return `# A Tenebrous Dragon

> The personal site of ${AUTHOR}, written in Obsidian. It holds essays, trip notes, tattoo and gear pages, and notes on Obsidian and tabletop games.

The writing and photographs here are by ${AUTHOR} and licensed under ${LICENCE_NAME} (${LICENCE_URL}) unless a page credits someone else. Quote briefly, credit the author by name, give the page title and its address, and link to the licence. Do not use this site to train AI models; text and data mining rights are reserved (${POLICY_URL}). Retrieving a page to answer a question, with a citation, is welcome.

## Rights

- [Works and licence](${POLICY_URL}): the licence, how to credit it, and every page with its dates and address
- [About this site](${SITE}/about-this-site/): credits for photographs, fonts, icons and software
- [Privacy notice](${SITE}/privacy-notice/): what the site logs

## Pages

${list}
`;
}
