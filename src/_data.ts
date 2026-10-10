import { coverCard, noteUrl } from "../lib/notes.ts";
export { jsonLd } from "../lib/rights.ts";

export const layout = "layout.vto";
const now = new Date();
const zone = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
// "9 October 2026, 16:20 CDT", the way the live footer writes it.
export const buildDate = `${now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}, ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ${zone}`;

// Her own commit count, linking to the latest commit, as on the live site. Until this has its own repo it reads Tenebrous-Site.
const git = (...args: string[]) => {
  const out = new Deno.Command("git", { args: ["-C", `${Deno.env.get("HOME")}/Developer/Tenebrous-Site`, ...args], stdout: "piped", stderr: "null" }).outputSync();
  return new TextDecoder().decode(out.stdout).trim();
};
export const commitCount = git("rev-list", "--count", "HEAD", "--author=sigrunixia@tenebrousdragon.com");
export const commitHash = git("rev-parse", "HEAD");

export function url(page: Lume.Page) {
  return noteUrl(page.src.path);
}


// The feed and the sitemap sort by date; a note's date is when it was last changed.
export function date(data: Record<string, unknown>) {
  return (data.modified ?? data.created) as Date | undefined;
}

// The picture a shared link shows: the note's cover, or the default.
export const socialImage = (data: Record<string, unknown>) => coverCard(data.cover) ?? "/static/og-image.png";
export const socialAlt = (data: Record<string, unknown>) => String(data["cover-alt"] ?? data.title ?? "Tenebrous Dragon");
