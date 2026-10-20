// Mermaid blocks become inline SVG at build time with Pele, so the page needs no script.
import { render } from "https://cdn.jsdelivr.net/npm/pele@1.7.0/dist/pele.js";

// Turns every ```mermaid block (markdown-it writes it as <pre><code class="language-mermaid">) into a figure holding the SVG.
// A block Pele cannot read stays as the code it was, and the build says which one.
export function diagrams(doc: Document, where: string) {
  for (const code of doc.querySelectorAll("pre > code.language-mermaid")) {
    try {
      const { svg } = render(code.textContent ?? "");
      const figure = doc.createElement("figure");
      figure.className = "diagram";
      figure.innerHTML = svg;
      code.parentElement!.replaceWith(figure);
    } catch (e) {
      console.warn(`Mermaid block left as code in ${where}: ${(e as Error).message}`);
    }
  }
}
