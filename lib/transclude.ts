// ![[Note]], ![[Note#Heading]] and ![[Note#^block]] on a line of their own bring that part of another note in,
// the way Obsidian does. Footnotes the part uses come with it, and a link to the heading it came from follows.
import { headingId } from "./notes.ts";

export type Source = { body: string; url: string; title: string };

const IMAGE = /\.(png|jpe?g|webp|gif|svg|avif|canvas)$/i;
const level = (line: string) => line.match(/^(#{1,6})\s/)?.[1].length ?? 0;
const comments = (md: string) => md.replace(/%%[\s\S]*?%%/g, "");

// The lines under a heading, up to the next heading of the same or a higher level.
function section(lines: string[], heading: string) {
  const want = heading.trim().toLowerCase();
  const start = lines.findIndex((l) => level(l) && l.replace(/^#+\s+/, "").trim().toLowerCase() === want);
  if (start < 0) return undefined;
  const depth = level(lines[start]);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (level(lines[i]) && level(lines[i]) <= depth) { end = i; break; }
  return lines.slice(start, end);
}

// The block a ^id marks, with the marker taken off. An id on a line of its own marks the block above it.
function block(lines: string[], id: string) {
  const mark = new RegExp(`\\s\\^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  const at = lines.findIndex((l) => mark.test(l));
  if (at < 0) return undefined;
  if (/^\s*\^/.test(lines[at])) {
    let top = at - 1;
    while (top >= 0 && lines[top].trim()) top--;
    return lines.slice(top + 1, at);
  }
  if (/^\s*([-*+]|\d+\.)\s/.test(lines[at])) {
    const indent = lines[at].match(/^\s*/)![0].length;
    let end = at + 1;
    while (end < lines.length && lines[end].trim() && (lines[end].match(/^\s*/)![0].length > indent)) end++;
    return [lines[at].replace(mark, ""), ...lines.slice(at + 1, end)];
  }
  let top = at, end = at;
  while (top > 0 && lines[top - 1].trim()) top--;
  while (end + 1 < lines.length && lines[end + 1].trim()) end++;
  return [...lines.slice(top, at), lines[at].replace(mark, ""), ...lines.slice(at + 1, end + 1)];
}

// Give the footnotes a part uses ids of their own, so they cannot clash with the page's footnotes.
function withFootnotes(part: string[], all: string[], prefix: string) {
  const text = part.join("\n");
  const ids = [...new Set([...text.matchAll(/\[\^([^\]]+)\]/g)].map((m) => m[1]))];
  if (!ids.length) return text;
  const defs = ids.map((id) => all.find((l) => l.startsWith(`[^${id}]:`))).filter(Boolean) as string[];
  const rename = (s: string) => s.replace(/\[\^([^\]]+)\]/g, (_, id) => `[^${prefix}-${id}]`);
  return rename(text) + "\n\n" + defs.map(rename).join("\n");
}

// A ^id at the end of a line only marks the block for embeds and links, so it is not shown.
export const withoutBlockIds = (md: string) => md.replace(/^\^[\w-]+[ \t]*$\n?/gm, "").replace(/[ \t]+\^[\w-]+[ \t]*$/gm, "");

export function transclude(md: string, find: (note: string) => Source | undefined, depth = 0, trail: string[] = []): string {
  if (depth > 3) return md;
  return md.split("\n").map((line) => {
    const m = line.match(/^((?:>\s*)*)!\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]\s*$/);
    if (!m) return line;
    const [, quote, target] = m;
    const [note, anchor] = target.split("#");
    if (!note || IMAGE.test(note.trim())) return line;
    const src = find(note.trim());
    if (!src) return `${quote}<span class="unresolved" title="No page on the site">${note.trim()}</span>`;
    if (trail.includes(src.url)) return line;
    const lines = comments(src.body).split("\n");
    let part: string[] | undefined = lines;
    if (anchor) part = anchor.startsWith("^") ? block(lines, anchor.slice(1)) : section(lines, anchor);
    if (!part) return `${quote}<span class="unresolved" title="Not found in ${src.title}">${target.trim()}</span>`;
    // Links to a heading in the same note, [[#Heading]], must still point at that note.
    let text = part.join("\n").replace(/\[\[#([^\]|]+)(\|[^\]]*)?\]\]/g, (_, h, name) => `[[${note.trim()}#${h}${name ?? `|${h}`}]]`);
    text = withFootnotes(text.split("\n"), lines, src.url.replace(/\W+/g, "") || "home");
    text = transclude(text, find, depth + 1, [...trail, src.url]);
    const href = src.url + (anchor && !anchor.startsWith("^") ? `#${headingId(anchor)}` : "");
    const out = `<div class="markdown-embed">\n\n${text.trim()}\n\n<p class="embed-source">From <a href="${href}">${src.title}</a></p>\n\n</div>`;
    return out.split("\n").map((l) => quote + l).join("\n");
  }).join("\n");
}
