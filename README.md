# Tenebrous-Site

The source of [tenebrousdragon.com](https://tenebrousdragon.com). It is a fork of [Quartz](https://quartz.jzhao.xyz) 5 that builds a website from the notes I have published in my Obsidian vault, and it is hosted on [Cloudflare](https://www.cloudflare.com) Workers as static assets.

The vault, the theme and this repo are separate things.

| Piece | Where it lives |
| --- | --- |
| The notes | My Obsidian vault, which is not in git. A note is published when its frontmatter has `publish: true`. |
| The look | [Tenebrous-Obsidian](https://github.com/sigrunixia/Tenebrous-Obsidian), my theme. It builds the Quartz stylesheet from the same palette as the Obsidian theme. |
| The build | This repo. |

## How a build works

`./build.sh` does everything in order.

1. **Compile the theme.** `sass` builds `src/main-quartz.scss` from the theme repo into `quartz/styles/tenebrous.css`.
2. **Stage the notes.** `stage.sh` copies only the published notes, and the files they embed, into `.stage/`, so Quartz never sees an unpublished note. It then runs the staging scripts below, which add generated pages and tidy the notes.
3. **Build with Quartz.** `npx quartz build -d .stage` writes the site into `public/`.
4. **Post-build passes.** A set of Python scripts rewrite the HTML to match what Obsidian shows, add things Quartz lacks, and fix accessibility. They run in a fixed order, and the accessibility pass runs last so it sees the final markup.
5. **Deploy.** `wrangler deploy` uploads `public/` using `wrangler.toml`.

### Staging scripts

| Script | What it does |
| --- | --- |
| `stage-permalinks.py` | Moves each note to its `permalink`, so the address matches the one Obsidian Publish used. |
| `stage-contact.py` | Drops the contact cards from the staged copy of my about page. The vault note is untouched. |
| `stage-places.py` | Writes a page for each place, listing the trips there, because the place notes are not published. |
| `stage-types.py` | Writes a page for each type and category, listing the published notes filed there. |
| `stage-sitemap.py` | Writes the Site map page, an index of the hubs, kinds, places and tags. |
| `stage-breadcrumbs.py` | Adds a breadcrumb to notes that lack one. It is not run now, because I write breadcrumbs by hand. |
| `stage-bases.py` | Rewrites Bases filters and formulas that the Quartz Bases plugin cannot evaluate. |

### Post-build passes

| Script | What it does |
| --- | --- |
| `bases-groups.py` | Adds the year headings that the Bases plugin leaves out. |
| `tag-pages.py` | Removes tag pages nobody needs, and redirects `/tags` and `/browse` to the Site map. |
| `graph-links.py` | Drops links that only come from breadcrumbs, so Home does not connect to every page. |
| `mark-links.py` | Marks links to unpublished notes, gives status tags and coloured highlights their classes. |
| `old-urls.py` | Writes `_redirects` so old Obsidian Publish addresses still work. Extra redirects go in `extra-redirects.txt`. |
| `bases-map.py` | Draws the Bases map view with Leaflet. |
| `card-covers.py` | Makes cropped thumbnails so card covers fill the card. |
| `infobox.py` | Builds the details box to the right of each note. |
| `inject-chrome.py`, `chrome.mjs` | Add the logo and social links from the theme. |
| `graph-button.py` | Adds the graph button beside the search bar. |
| `page-nav.py` | Adds the back-to-top button and the outline on phones. |
| `a11y-fix.py` | Adds landmarks, language marks, labels and alt text from captions. |
| `footer-links.py` | Adds the footer links and the feed link. |
| `home-links.py` | Adds the links list to the home page. |

The scripts the browser needs live in `quartz/static` (`back-to-top.js`, `base-map.js`, `graph-button.js`) and the libraries they load are in `quartz/static/vendor`, so the site makes no calls to a CDN.

## Building it yourself

You need macOS or Linux, Node (which Quartz uses through `npx`), `python3`, `perl`, `sass`, `esbuild` and `wrangler`. The theme repo must be cloned next to this one, or set `THEME_DIR`.

```bash
VAULT=/path/to/the/vault ./build.sh   # build into public/
wrangler deploy                       # publish to Cloudflare
```

`VAULT` is the vault folder. Without it, `build.sh` uses the default path in the script.

**Preview.** `TENEBRISM=1 ./build.sh` adds a `noindex` tag and lets `?look=spotlight` switch to the plain look. Deploy it with `wrangler deploy -c wrangler.preview.toml`. After a preview build, always run a normal build before deploying to the live site.

## Checking the result

```bash
python3 a11y-audit.py public
```

The audit lists the problems it can find against WCAG 2.2 AA, such as missing alt text, unlabelled controls and heading levels. Photos that still need alt text are written to `a11y-alt-todo.txt`, which is not tracked.

## Updating Quartz

`upstream` is the original Quartz repo.

```bash
git fetch upstream
git merge upstream/v5
```

Most of my changes add files, so conflicts are rare. The few Quartz files I have edited are `quartz/styles/custom.scss` and `quartz/static/icon.png`.

## Credits and licences

This is a fork of [Quartz](https://github.com/jackyzha0/quartz) by Jacky Zhao, which is under the [MIT License](https://github.com/jackyzha0/quartz/blob/v4/LICENSE.txt). The vendored libraries are [Leaflet](https://leafletjs.com) (BSD 2-Clause), [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) (MIT), [d3](https://d3js.org) (ISC) and [PixiJS](https://pixijs.com) (MIT). Fonts, icons, photographs and the content licence are listed on the [About This Site](https://tenebrousdragon.com/about-this-site) page.

The original Quartz readme is in the [upstream repo](https://github.com/jackyzha0/quartz#readme).
