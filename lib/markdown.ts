// The Obsidian Markdown that Lume's own renderer does not know: image embeds, footnotes and task lists.
// Each function takes a note's Markdown and gives it back with the HTML that stands in for the syntax.
import { fileSlug } from "./notes.ts";

const IMAGE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// ![[picture.jpg]] and ![[picture.jpg|description]] become an image. Other embeds are left for the link step.
export function embeds(md: string) {
  return md.replace(/!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (all, file: string, alt?: string) => {
    const name = file.split("/").pop()!.trim();
    if (!IMAGE.test(name)) return all;
    return `<span class="internal-embed image-embed"><img src="/img/${fileSlug(name)}" alt="${esc(alt ?? "")}" loading="lazy"></span>`;
  });
}

// [^id] marks and [^id]: text definitions become numbered superscripts and a list at the end.
export function footnotes(md: string) {
  const defs = new Map<string, string>();
  const body = md.replace(/^\[\^([^\]]+)\]:[ \t]*(.*)$/gm, (_, id: string, text: string) => {
    defs.set(id, text);
    return "";
  });
  if (!defs.size) return md;
  const order: string[] = [];
  const seen = new Map<string, number>();
  const out = body.replace(/\[\^([^\]]+)\]/g, (all, id: string) => {
    if (!defs.has(id)) return all;
    if (!order.includes(id)) order.push(id);
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    const ref = n === 1 ? `fnref-${id}` : `fnref-${id}-${n}`;
    return `<sup><a href="#fn-${id}" id="${ref}" data-footnote-ref>${order.indexOf(id) + 1}</a></sup>`;
  });
  const items = order.map((id, i) => `${i + 1}. <span id="fn-${id}"></span>${defs.get(id)} <a href="#fnref-${id}" data-footnote-backref aria-label="Back to reference ${i + 1}">↩</a>`);
  return `${out.trimEnd()}\n\n<section data-footnotes class="footnotes">\n\n<h2 class="visually-hidden" id="footnote-label">Footnotes</h2>\n\n${items.join("\n")}\n\n</section>\n`;
}

// - [ ] and - [x], and Obsidian's other one-character statuses, become checkboxes. The status goes in data-task.
export function tasks(md: string) {
  return md.replace(/^((?:>\s*)*\s*(?:[-*+]|\d+\.)\s+)\[([^\]])\](?=\s)/gm, (_, lead: string, c: string) =>
    `${lead}<input type="checkbox" class="checkbox-toggle" data-status="${esc(c)}"${c === " " ? "" : " checked"}>`);
}

// After rendering: the list item and list around a checkbox get the classes the theme styles.
export function markTasks(doc: Document) {
  for (const input of doc.querySelectorAll("input.checkbox-toggle[data-status]")) {
    const li = input.parentElement;
    if (!li || li.tagName !== "LI") continue;
    const status = input.getAttribute("data-status") ?? " ";
    li.classList.add("task-list-item");
    if (status !== " ") li.classList.add("is-checked");
    li.setAttribute("data-task", status);
    li.parentElement?.classList.add("contains-task-list");
    input.removeAttribute("data-status");
    input.setAttribute("aria-label", (li.textContent ?? "").trim().slice(0, 120));
  }
}

// Runs a rewrite on the Markdown outside fenced code blocks, so examples of the syntax are left as they are.
export function outsideCode(md: string, fn: (text: string) => string) {
  return md.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/).map((part, i) => (i % 2 ? part : fn(part))).join("");
}
