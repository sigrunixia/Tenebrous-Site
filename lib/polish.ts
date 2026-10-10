// Fixes applied to every page after it is rendered: external links, Greek language marks, and unique ids.
const ICON = '<svg aria-hidden="true" focusable="false" class="external-icon" style="max-width:0.8em;max-height:0.8em;" viewBox="0 0 512 512"><path d="M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z"></path></svg>';
const HIDDEN = '<span class="visually-hidden"> (opens in a new tab)</span>';

// A link to another website gets the arrow, opens in a new tab, and says so to screen readers.
export function externalLinks(doc: Document, host: string) {
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href")!;
    if (!/^https?:\/\//.test(href) || new URL(href).hostname === host) continue;
    a.classList.add("external");
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", a.getAttribute("rel")?.includes("me") ? "noopener me" : "noopener noreferrer");
    const label = a.getAttribute("aria-label");
    if (label) {
      if (!label.includes("opens in a new tab")) a.setAttribute("aria-label", `${label} (opens in a new tab)`);
    } else if (!a.querySelector("img") && !a.innerHTML.includes("opens in a new tab")) {
      a.innerHTML += (a.closest(".site-social-links") ? "" : ICON) + HIDDEN;
    }
  }
}

// Greek text is wrapped in lang="el", so a screen reader switches voice.
const WORD = "[Ͱ-Ͽἀ-῿]+(?:['’\\-][Ͱ-Ͽἀ-῿]+)*";
const RUN = new RegExp(`${WORD}(?: ${WORD})*`, "g");

export function greekLang(html: string) {
  const parts = html.split(/(<[^>]+>)/);
  let skip = "";
  let lang = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith("<")) {
      const m = p.match(/^<(\/?)(script|style|svg|textarea|title)\b/i);
      if (m) skip = m[1] ? "" : m[2].toLowerCase();
      if (/\blang="el"/.test(p)) lang++;
      continue;
    }
    if (skip || lang) continue;
    parts[i] = p.replace(RUN, (g) => `<span lang="el">${g}</span>`);
  }
  return parts.join("");
}

// Headings with the same text get -2, -3 and so on, so each id appears once on a page.
export function uniqueIds(doc: Document, id: (text: string) => string) {
  const used = new Set<string>();
  for (const el of doc.querySelectorAll("article [id]")) used.add(el.id);
  const count = new Map<string, number>();
  const seen = new Set<string>();
  for (const h of doc.querySelectorAll("article h1, article h2, article h3, article h4, article h5, article h6")) {
    let want = h.id || id(h.textContent);
    if (seen.has(want)) {
      let n = (count.get(want) ?? 1) + 1;
      while (used.has(`${want}-${n}`)) n++;
      count.set(want, n);
      want = `${want}-${n}`;
    }
    seen.add(want);
    used.add(want);
    h.id = want;
  }
}
