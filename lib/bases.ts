// A small reader for the part of Obsidian Bases the site uses. A `base` code block in a note is
// a YAML document with filters, formulas and views. This runs the filters and formulas and
// writes the cards view as HTML. It does not cover every Bases function, only the ones the notes use.
import { parse } from "jsr:@std/yaml@1";
import { coverCard, noteUrl, titleOf } from "./notes.ts";

type Val = unknown;
export type Note = { path: string; data: Record<string, Val> };

// Tokens and parser for expressions like !file.name.contains("Template") or started.toString() <= "2026-10-09".
type Tok = { t: string; v: string };
function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([A-Za-z_][\w]*)|(==|!=|<=|>=|&&|\|\||[()\[\].,!<>+\-*/]))/gy;
  let m: RegExpExecArray | null;
  while (re.lastIndex < src.length && (m = re.exec(src))) {
    if (m[1] !== undefined) out.push({ t: "num", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "str", v: m[2].replace(/\\(.)/g, "$1") });
    else if (m[3] !== undefined) out.push({ t: "str", v: m[3].replace(/\\(.)/g, "$1") });
    else if (m[4] !== undefined) out.push({ t: "id", v: m[4] });
    else out.push({ t: "op", v: m[5] });
  }
  return out;
}

// resolve turns a [[link]] into the note it names (its properties), for asFile().
export type Resolve = (link: string) => Record<string, Val> | undefined;
type Env = { note: Note; formulas: Record<string, string>; cache: Map<string, Val>; resolve: Resolve };

function evaluate(src: string, env: Env): Val {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const eat = (v?: string) => (v === undefined || toks[i]?.v === v ? toks[i++] : undefined);

  function primary(): Val {
    const k = toks[i++];
    if (!k) return undefined;
    if (k.t === "num") return Number(k.v);
    if (k.t === "str") return k.v;
    if (k.v === "(") { const v = or(); eat(")"); return v; }
    if (k.v === "!") return !truthy(postfix(primary()));
    if (k.v === "-") return -Number(postfix(primary()));
    if (k.t === "id") {
      if (k.v === "true") return true;
      if (k.v === "false") return false;
      if (k.v === "null") return null;
      if (peek()?.v === "(") {
        eat("(");
        const args: Val[] = [];
        const raw = i;
        // Arguments are evaluated lazily for `if`, so remember where each starts.
        if (k.v === "if") {
          const c = or(); eat(",");
          const aStart = i; skipExpr(); eat(",");
          const bStart = i; skipExpr(); eat(")");
          const end = i;
          const run = (s: number) => { i = s; const v = or(); return v; };
          const result = truthy(c) ? run(aStart) : run(bStart);
          i = end;
          return result;
        }
        if (peek()?.v !== ")") { do args.push(or()); while (eat(",")); }
        eat(")");
        void raw;
        return callFn(k.v, args);
      }
      return ident(k.v);
    }
    return undefined;
  }

  function skipExpr() {
    let depth = 0;
    while (i < toks.length) {
      const v = toks[i].v, t = toks[i].t;
      if (t === "op" && (v === "(" || v === "[")) depth++;
      else if (t === "op" && (v === ")" || v === "]")) { if (depth === 0) return; depth--; }
      else if (t === "op" && v === "," && depth === 0) return;
      i++;
    }
  }

  function ident(name: string): Val {
    if (name === "file") return fileObj(env.note);
    if (name === "note") return env.note.data;
    if (name === "formula") return new Proxy({}, { get: (_, p) => formula(String(p), env) });
    return env.note.data[name];
  }

  function postfix(v: Val): Val {
    for (;;) {
      if (eat(".")) {
        const name = toks[i++].v;
        if (peek()?.v === "(") {
          eat("(");
          const args: Val[] = [];
          if (peek()?.v !== ")") { do args.push(or()); while (eat(",")); }
          eat(")");
          v = callMethod(v, name, args, env);
        } else v = prop(v, name);
      } else if (peek()?.v === "[") {
        eat("["); const idx = or(); eat("]");
        v = (v as Record<string, Val>)?.[String(idx)];
      } else return v;
    }
  }

  const unary = () => postfix(primary());
  function bin(next: () => Val, ops: string[], fn: (op: string, a: Val, b: Val) => Val): () => Val {
    return () => {
      let a = next();
      while (peek() && ops.includes(peek().v) && peek().t === "op") { const op = toks[i++].v; a = fn(op, a, next()); }
      return a;
    };
  }
  const mul = bin(unary, ["*", "/"], (o, a, b) => (o === "*" ? Number(a) * Number(b) : Number(a) / Number(b)));
  const add = bin(mul, ["+", "-"], (o, a, b) => (o === "+" ? (typeof a === "number" && typeof b === "number" ? a + b : String(a ?? "") + String(b ?? "")) : Number(a) - Number(b)));
  const cmp = bin(add, ["==", "!=", "<", "<=", ">", ">="], (o, a, b) => compare(o, a, b));
  const and = bin(cmp, ["&&"], (_, a, b) => truthy(a) && truthy(b));
  const or: () => Val = bin(and, ["||"], (_, a, b) => truthy(a) || truthy(b));

  return or();
}

const truthy = (v: Val) => !(v === undefined || v === null || v === false || v === "" || v === 0 || (Array.isArray(v) && v.length === 0));

function text(v: Val): string {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(text).join(",");
  return String(v ?? "");
}

function compare(op: string, a: Val, b: Val): boolean {
  const x = a instanceof Date ? a.toISOString() : a, y = b instanceof Date ? b.toISOString() : b;
  switch (op) {
    case "==": return x === y || (x != null && y != null && String(x) === String(y));
    case "!=": return !compare("==", a, b);
    case "<": return (x as number) < (y as number);
    case "<=": return (x as number) <= (y as number);
    case ">": return (x as number) > (y as number);
    default: return (x as number) >= (y as number);
  }
}

function fileObj(n: Note) {
  const base = n.path.split("/").pop()!;
  return { name: base.replace(/\.md$/, ""), fullname: base, path: n.path, ext: "md" };
}

function prop(v: Val, name: string): Val {
  if (v instanceof Date) return name === "year" ? v.getUTCFullYear() : name === "month" ? v.getUTCMonth() + 1 : name === "day" ? v.getUTCDate() : undefined;
  return (v as Record<string, Val>)?.[name];
}

function callMethod(v: Val, name: string, args: Val[], env: Env): Val {
  switch (name) {
    case "asFile": {
      const props = env.resolve(text(v));
      return props ? { properties: props, name: text(v).replace(/^\[\[|\]\]$/g, "").split("|").pop() } : undefined;
    }
    case "contains": return Array.isArray(v) ? v.some((x) => text(x) === text(args[0])) : text(v).includes(text(args[0]));
    case "containsAny": return args.some((a) => text(v).includes(text(a)));
    case "startsWith": return text(v).startsWith(text(args[0]));
    case "endsWith": return text(v).endsWith(text(args[0]));
    case "join": return (Array.isArray(v) ? v : [v]).map(text).join(text(args[0]));
    case "isEmpty": return !truthy(v);
    case "toString": return text(v);
    case "replace": return text(v).split(text(args[0])).join(text(args[1]));
    case "lower": return text(v).toLowerCase();
    case "length": return Array.isArray(v) ? v.length : text(v).length;
    default: return undefined;
  }
}

function callFn(name: string, args: Val[]): Val {
  switch (name) {
    case "date": return args[0] instanceof Date ? args[0] : new Date(text(args[0]));
    case "list": return Array.isArray(args[0]) ? args[0] : args[0] == null ? [] : [args[0]];
    case "now": return new Date();
    case "today": return new Date(new Date().toISOString().slice(0, 10));
    default: return undefined;
  }
}

function formula(name: string, env: Env): Val {
  if (env.cache.has(name)) return env.cache.get(name);
  const src = env.formulas[name];
  const v = src === undefined ? undefined : evaluate(src, env);
  env.cache.set(name, v);
  return v;
}

type Filter = string | { and?: Filter[]; or?: Filter[]; not?: Filter[] };
function passes(f: Filter | undefined, env: Env): boolean {
  if (f === undefined) return true;
  if (typeof f === "string") return truthy(evaluate(f, env));
  if (f.and) return f.and.every((x) => passes(x, env));
  if (f.or) return f.or.some((x) => passes(x, env));
  if (f.not) return !f.not.some((x) => passes(x, env));
  return true;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function show(v: Val): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(show).join(", ");
  return String(v ?? "").replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
}

type View = {
  type: string; coordinates?: string; markerIcon?: string; markerColor?: string; defaultZoom?: number; center?: string; name?: string; filters?: Filter; order?: string[]; limit?: number; image?: string; imageFit?: string;
  sort?: { property: string; direction?: string }[]; groupBy?: { property: string; direction?: string };
};
type Base = { filters?: Filter; formulas?: Record<string, string>; properties?: Record<string, { displayName?: string }>; views?: View[] };

export type MapPayload = { zoom?: number; center?: number[]; markers: { name: string; lat: string; lng: string; icon?: string; color?: string; url: string }[] };
export type Context = { resolve: Resolve; map: (payload: MapPayload) => string };

export function renderBase(source: string, notes: Note[], ctx: Context): string {
  const base = parse(source) as Base;
  const formulas = base.formulas ?? {};
  const view = (base.views ?? [])[0];
  if (!view) return "";
  const envFor = (note: Note): Env => ({ note, formulas, cache: new Map(), resolve: ctx.resolve });
  const rows = notes
    .map((note) => ({ note, env: envFor(note) }))
    .filter(({ env }) => passes(base.filters, env) && passes(view.filters, env));

  const value = (r: { note: Note; env: Env }, propName: string): Val => {
    if (propName === "file.name") return titleOf(r.note.data, r.note.path);
    if (propName.startsWith("formula.")) return formula(propName.slice(8), r.env);
    if (propName.startsWith("note.")) return r.note.data[propName.slice(5)];
    if (propName.startsWith("file.")) return (fileObj(r.note) as Record<string, Val>)[propName.slice(5)];
    return r.note.data[propName];
  };

  for (const s of [...(view.sort ?? [])].reverse()) {
    const dir = (s.direction ?? "ASC").toUpperCase() === "DESC" ? -1 : 1;
    rows.sort((a, b) => {
      const x = text(value(a, s.property)), y = text(value(b, s.property));
      return x < y ? -dir : x > y ? dir : 0;
    });
  }
  if (view.type === "map") return ctx.map(mapPayload(view, rows, value));
  const total = rows.length;
  const shown = view.limit ? rows.slice(0, view.limit) : rows;

  const groups = new Map<string, typeof rows>();
  if (view.groupBy) {
    const dir = (view.groupBy.direction ?? "ASC").toUpperCase() === "DESC" ? -1 : 1;
    for (const r of shown) {
      const g = text(value(r, view.groupBy.property));
      groups.set(g, [...(groups.get(g) ?? []), r]);
    }
    const sorted = [...groups.entries()].sort(([a], [b]) => (a < b ? -dir : a > b ? dir : 0));
    groups.clear();
    sorted.forEach(([k, v]) => groups.set(k, v));
  } else groups.set("", shown);

  const label = (p: string) => base.properties?.[p]?.displayName ?? p.replace(/^(note|file|formula)\./, "");
  const cols = (view.order ?? []).filter((p) => p !== "file.name");

  const card = (r: { note: Note; env: Env }) => {
    const url = noteUrl(r.note.path);
    const title = esc(String(value(r, "file.name")));
    const cover = view.image ? coverCard(value(r, view.image)) : undefined;
    const img = cover
      ? `<div class="bases-card-image"><img src="${cover}" alt="${title}" loading="lazy" style="object-fit:${view.imageFit ?? "cover"}"></div>`
      : view.image ? `<div class="bases-card-image bases-card-placeholder"></div>` : "";
    const meta = cols.map((p) => ({ p, v: show(value(r, p)) })).filter((x) => x.v)
      .map((x) => `<div class="bases-card-row"><span class="bases-card-label">${esc(label(x.p))}</span><span class="bases-card-value">${esc(x.v)}</span></div>`).join("");
    return `<a href="${url}" class="bases-card">${img}<div class="bases-card-body"><span class="bases-card-title">${title}</span>${meta ? `<div class="bases-card-meta">${meta}</div>` : ""}</div></a>`;
  };

  let html = `<div class="bases-cards-wrapper"><div class="bases-view-meta">Showing ${shown.length} of ${total} entries</div><div class="bases-cards">`;
  for (const [g, rs] of groups) {
    if (view.groupBy) html += `<h2 class="bases-group-heading">${esc(g)}</h2>`;
    html += rs.map(card).join("");
  }
  return html + "</div></div>";
}

// The markers of a map view: a note with coordinates is a marker, named for the note, with the icon and colour its formulas give.
function mapPayload(view: View, rows: { note: Note; env: Env }[], value: (r: { note: Note; env: Env }, p: string) => Val): MapPayload {
  const markers = rows.flatMap((r) => {
    const c = [value(r, view.coordinates ?? "note.coordinates")].flat();
    if (c.length < 2 || c.some((x) => x === undefined || x === null || x === "")) return [];
    const icon = view.markerIcon ? text(value(r, view.markerIcon)) : "";
    const color = view.markerColor ? text(value(r, view.markerColor)) : "";
    return [{ name: titleOf(r.note.data, r.note.path), lat: String(c[0]), lng: String(c[1]), icon: icon || undefined, color: color || undefined, url: noteUrl(r.note.path) }];
  });
  let center: number[] | undefined;
  try { center = JSON.parse(String(view.center ?? "")); } catch { /* no centre given */ }
  return { zoom: view.defaultZoom, center, markers };
}
