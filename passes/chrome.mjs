// Print the logo and social link row as HTML, from the theme's own link list.
// usage: node chrome.mjs <compiled links module>
const { SOCIAL_LINKS } = await import(process.argv[2])

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

const icon = ({ path, stroke }) => {
  if (stroke) {
    const shapes = stroke
      .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(" ")}></${tag}>`)
      .join("")
    return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`
  }
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${esc(path)}" fill="currentColor"></path></svg>`
}

const links = SOCIAL_LINKS.map((l) => {
  const ext = l.href.startsWith("mailto:") ? "" : ' target="_blank" rel="noopener me"'
  return `<a class="site-social-link" href="${esc(l.href)}"${ext} aria-label="${esc(l.label)}" title="${esc(l.label)}">${icon(l)}</a>`
}).join("")

process.stdout.write(
  `<div class="site-dragon"><img src="/static/tenebrous-dragon.png" alt="" width="520" height="567" draggable="false"></div>` +
    `<div class="site-social-links">${links}</div>`,
)
