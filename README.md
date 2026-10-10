# Tenebrous-Site

The source for [tenebrousdragon.com](https://tenebrousdragon.com). It builds the notes marked `publish: true` in my Obsidian vault with [Lume](https://lume.land) on Deno and deploys them to Cloudflare Workers. The look comes from [Tenebrous-Obsidian](https://github.com/sigrunixia/Tenebrous-Obsidian), which has to sit next to this folder. It used to run on Quartz; the last Quartz commit is tagged `quartz-final`.

## Build

```bash
./sync.sh
./build.sh
wrangler deploy
```

`sync.sh` stages the published notes and their pictures. `build.sh` compiles the stylesheet with Sass and builds the site into `_site/`. Use `deno task serve` to preview it. Deno, Sass and Wrangler come from brew, and nothing here uses npm.

## Folders

- `stage/` copies the published notes into `.stage/` and writes the generated pages.
- `scss/` is the stylesheet, starting at `main.scss`. `scss/site/` holds the parts only the site uses, with the site colours.
- `lib/` has the code that turns notes, Bases, canvases and the infobox into HTML.
- `src/` is the site itself, with its layouts, scripts, fonts and data.
- `_config.ts` sets up Lume and its plugins.

Fonts, icons and photo credits are on the [About This Site](https://tenebrousdragon.com/about-this-site) page.
