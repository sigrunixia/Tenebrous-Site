// Helpers shared by the config and the data files.
import createSlugifier from "lume/core/slugifier.ts";

// Page addresses use Lume's slugifier, so they match what the slugify plugin writes. Letters in any script stay.
const slugify = createSlugifier({ alphanumeric: false });

export const slugOf = (name: string) => decodeURI(slugify(name));

// Image files keep the names the staging step gave them.
export const fileSlug = (name: string) => name.toLowerCase().replace(/ /g, "-").replace(/&/g, "-and-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// The file served for an embedded picture. Photos and screenshots are resized and written as WebP by sync.sh,
// under the original name with .webp added (photo.jpeg is photo.jpeg.webp). SVGs, GIFs and WebP keep their names.
export const imageFile = (name: string) => {
  const file = fileSlug(name);
  return /\.(png|jpe?g|avif)$/i.test(file) ? file + ".webp" : file;
};

// The staging step names each file after its address, folders included (places/athens), so the
// path under notes/ is the address. Quartz lower-cases it and turns spaces into hyphens.
export function noteUrl(srcPath: string) {
  const path = srcPath.replace(/^\/notes\//, "").replace(/\.md$/, "");
  if (path === "index") return "/";
  return "/" + path.replace(/\/index$/, "").split("/").map(slugOf).join("/") + "/";
}

export function wikiTarget(v: unknown): string | undefined {
  return String(v ?? "").match(/\[\[([^\]|]*)/)?.[1];
}

// The card version of a cover image, written by the staging step next to the original.
export function coverCard(cover: unknown) {
  const name = wikiTarget(cover);
  if (!name) return undefined;
  const file = fileSlug(name);
  // An SVG icon is used as it is; a photo has a card-sized copy beside it.
  return "/img/" + (file.endsWith(".svg") ? file : file.replace(/\.[^.]+$/, "") + ".card.webp");
}

export function titleOf(data: Record<string, unknown>, srcPath: string) {
  if (data.title) return String(data.title);
  const h1 = String(data.content ?? "").match(/^# (.+)$/m)?.[1];
  return h1 ?? srcPath.split("/").pop()!.replace(/\.md$/, "");
}

// The id a heading gets, and so the anchor a link to it uses.
export const headingId = (text: string) => text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
