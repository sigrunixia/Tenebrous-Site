import { titleOf } from "../lib/notes.ts";
import { AUTHOR, LICENCE_NAME, LICENCE_URL, SITE } from "../lib/rights.ts";

export const layout = "layout.vto";

const long = (d: unknown) => (d instanceof Date ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : "");

// The licence, how to credit it, and every published page with its dates and address.
export default function* ({ search }: Lume.Data) {
  const works = search.pages("publish=true")
    .filter((p) => p.created instanceof Date)
    .sort((a, b) => (a.created as Date).getTime() - (b.created as Date).getTime());
  const rows = works.map((p) => {
    const title = titleOf(p, p.url);
    return `<tr><td><a href="${p.url}">${title}</a></td><td><time datetime="${iso(p.created)}">${long(p.created)}</time></td><td>${p.modified ? `<time datetime="${iso(p.modified)}">${long(p.modified)}</time>` : ""}</td></tr>`;
  }).join("");
  const sample = works[0];
  const content = `<p><a href="/">Home</a> / <a href="/works/">Works and licence</a></p>
<h1 class="article-title">Works and licence</h1>
<p>Unless a page credits someone else, the writing and photographs on this site are by ${AUTHOR} and licensed under <a href="${LICENCE_URL}" rel="license" class="external">${LICENCE_NAME}</a>. You may share and adapt them for non-commercial purposes if you credit me and share your changes under the same licence.</p>
<h2>How to credit</h2>
<p>Give my name, the title of the page, its address and a link to the licence. For example, ${AUTHOR}, "${sample ? titleOf(sample, sample.url) : "Page title"}", ${SITE}${sample ? sample.url : "/"}, <a href="${LICENCE_URL}" class="external">${LICENCE_NAME}</a>.</p>
<h2>AI and automated use</h2>
<p>I reserve the right to text and data mining of this site, so it may not be used to train AI models. The site says so in a <code>tdm-reservation</code> header, in <code>/.well-known/tdmrep.json</code> and in its <a href="/robots.txt">robots.txt</a>. An assistant that fetches a page to answer a question may quote it briefly, with a citation and a link. A short guide for machines is in <a href="/llms.txt">llms.txt</a>.</p>
<h2>What is not mine</h2>
<p>Some photographs, icons, fonts and software here belong to other people and keep their own licences. They are credited on <a href="/about-this-site/">About this site</a> and on the page that uses them.</p>
<h2>An earlier licence</h2>
<p>Until 10 October 2026 the site said CC BY-SA 4.0. Anyone who took a copy under that licence keeps it for that copy. Everything shared from now on is ${LICENCE_NAME}.</p>
<h2>Every work</h2>
<table><thead><tr><th>Page</th><th>First written</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table>`;
  yield { url: "/works/", title: "Works and licence", description: "The licence, how to credit it, and every page with its dates", content };
}
