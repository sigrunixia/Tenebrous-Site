// An Obsidian canvas (JSON Canvas) as HTML. Text, file (image) and group nodes are placed where
// the canvas puts them; a script adds pan and zoom. The canvas colour presets use the palette.
type Node = { id: string; type: string; x: number; y: number; width: number; height: number; text?: string; file?: string; label?: string; color?: string; url?: string };
type Canvas = { nodes: Node[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const HUES: Record<string, string> = { "1": "red", "2": "orange", "3": "yellow", "4": "green", "5": "cyan", "6": "purple" };
export const slug = (s: string) => s.toLowerCase().replace(/ /g, "-").replace(/&/g, "-and-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// The little bit of Markdown the text nodes use, on one escaped line at a time.
function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" class="external" target="_blank" rel="noopener noreferrer">$1</a>');
}

function markdown(text: string) {
  return text.split(/\n{2,}/).map((block) => {
    const h = block.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const level = 2; return `<h${level}>${inline(h[2])}</h${level}>`; }
    return `<p>${block.split("\n").map(inline).join("<br>")}</p>`;
  }).join("");
}

export function renderCanvas(json: Canvas, title: string) {
  const nodes = json.nodes;
  const minX = Math.min(...nodes.map((n) => n.x)), minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width)), maxY = Math.max(...nodes.map((n) => n.y + n.height));
  const pad = 50;
  const order = { group: 0, file: 1, text: 2 } as Record<string, number>;
  const body = [...nodes].sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3)).map((n) => {
    const hue = n.color && HUES[n.color] ? ` canvas-${HUES[n.color]}` : "";
    const style = `left:${n.x - minX + pad}px;top:${n.y - minY + pad}px;width:${n.width}px;height:${n.height}px`;
    if (n.type === "group") return `<div class="canvas-node canvas-group${hue}" style="${style}"><span class="canvas-label">${esc(n.label ?? "")}</span></div>`;
    if (n.type === "file") return `<div class="canvas-node canvas-file${hue}" style="${style}"><img src="/img/${slug(n.file!.split("/").pop()!)}" alt="" loading="lazy" draggable="false"></div>`;
    if (n.type === "text") return `<div class="canvas-node canvas-text${hue}" style="${style}">${markdown(n.text ?? "")}</div>`;
    return "";
  }).join("");
  const w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
  return `<div class="canvas-container" role="region" aria-label="${esc(title)}, a canvas you can drag and zoom" tabindex="0">
<div class="canvas-controls"><button class="canvas-zoom-in" type="button" aria-label="Zoom in">+</button><button class="canvas-zoom-out" type="button" aria-label="Zoom out">&minus;</button><button class="canvas-reset-view" type="button" aria-label="Reset view">Reset</button></div>
<div class="canvas-world" style="width:${w}px;height:${h}px">${body}</div></div>`;
}
