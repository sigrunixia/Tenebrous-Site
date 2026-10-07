# Tenebrous-Site

My copy of [Quartz](https://quartz.jzhao.xyz) 5 for [tenebrousdragon.com](https://tenebrousdragon.com). It builds the notes marked `publish: true` in my Obsidian vault and deploys them to Cloudflare Workers. The look comes from [Tenebrous-Obsidian](https://github.com/sigrunixia/Tenebrous-Obsidian).

## Build

```bash
./build.sh
wrangler deploy
```

For the preview, run `TENEBRISM=1 ./build.sh` and `wrangler deploy -c wrangler.preview.toml`, then build normally again.

## Folders

- `stage/` copies the published notes into `.stage/` and writes the generated pages.
- `passes/` holds the scripts that run on the HTML after Quartz, in the order `build.sh` calls them. `passes/data/` has the lists they read.
- `theme/` has the Quartz SCSS in `src/`, its `assets/`, the compiled Tenebrous CSS, and `THEME.md`, a list of the classes it expects and which script adds each one. Each version is on the [releases page](https://github.com/sigrunixia/Tenebrous-Site/releases).
- `a11y/` fixes accessibility last, and `a11y-audit.py` checks the result.

## Updating Quartz

```bash
git fetch upstream
git merge upstream/v5
```

Quartz is MIT licensed. Fonts, icons and photo credits are on the [About This Site](https://tenebrousdragon.com/about-this-site) page.
