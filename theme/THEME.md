# Tenebrous theme for Quartz

This is the Quartz half of the Tenebrous theme. [Tenebrous-Obsidian](https://github.com/sigrunixia/Tenebrous-Obsidian) is the Obsidian half, and it mostly works on Obsidian Publish too. Anything only Quartz needs lives here. The palette, typography, dark theme and callouts are shared, so Sass reads those from the Obsidian repo. The colours only the site uses are in `src/_site-palette.scss`, written by hand and listed at the end of this file.

The SCSS is in `src/`, starting at `main.scss`. `build.sh` compiles it to `tenebrous.css` and copies that into Quartz, so edit the SCSS and never the compiled file. The fonts and the favicons are in `assets/`.

The CSS does very little by itself, because most of it styles classes that get added after Quartz has built the page. Here is what adds what.

| Class | Added by | What it is |
| --- | --- | --- |
| `theme-dark`, `tenebrism`, `home` on `<html>` | `build.sh` | The palette, the look, and the home page layout |
| `markdown-reading-view` | `build.sh` | Lets Obsidian's reading-view styles apply |
| `breadcrumb` | `build.sh` | The breadcrumb line at the top of a note |
| `external`, `external-icon` | Quartz, and `passes/external-links.py` for the arrow, the new tab and the label | A link to another website, in cyan with an arrow |
| `unresolved` | `passes/mark-links.py` | A link to a note that is not published, dotted |
| `tag-line`, `tl-<tag>` | `passes/mark-links.py` | A line that starts with a status tag |
| `text-highlight`, `hl-<colour>` | `passes/mark-links.py` | A highlight, coloured by its emoji |
| `infobox`, `infobox-side`, `infobox-inline`, `infobox-credit` | `passes/infobox.py` | The details box beside a note, and its copy on phones |
| `site-header`, `site-header-text`, `site-social-links` | `passes/inject-chrome.py` | The site name and social links |
| `graph-open`, `graph-close` | `passes/graph-button.py` | The graph button and its close button |
| `back-to-top`, `page-outline-mobile` | `passes/page-nav.py` | Back to top, and the outline on phones |
| `base-map-embed` | `passes/bases-map.py` | The Leaflet map |
| `bases-group-heading` | `passes/bases-groups.py` | Year headings in a Bases list |
| `bases-card-image`, `--cover` | `build.sh`, `passes/card-covers.py` | The blurred cover behind a card image |
| `bases-card-placeholder` | `passes/card-covers.py` | The compass on a trip card with no cover |
| `skip-link`, `visually-hidden` | `a11y/a11y-fix.py` | The skip link, and text only a screen reader sees |

## Colours only the site uses

These sit in `src/_site-palette.scss` and are not part of the shared palette. The contrast is against `bg` (`#0d0f14`).

| Where it shows up | Name | Hex | Contrast | WCAG |
|---|---|---|---|---|
| Brown highlight | brown | `#b0825a` | 5.65 | AA |
| Field and button edge | edge | `#59607f` | 3.11 | UI only |
| Field and button edge, more contrast | edge-high | `#9aa1c4` | 7.55 | AAA |
| Faint text, more contrast | faint-high | `#b4bad8` | 10.00 | AAA |
| Secondary text, more contrast | text-high | `#d0d5ee` | 13.18 | AAA |
| Sidebar line in the shadow | shadow-line | `#1c202c` | 1.18 | Decoration only |

