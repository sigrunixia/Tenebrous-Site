# Tenebrous theme for Quartz

This is the Quartz theme for [tenebrousdragon.com](https://tenebrousdragon.com). [Tenebrous-Obsidian](https://github.com/sigrunixia/Tenebrous-Obsidian) is the Obsidian theme, and it works with Obsidian Publish too, mostly. Everything that only Quartz needs lives here.

`tenebrous.css` is built by `build.sh` from `src/main-quartz.scss` in Tenebrous-Obsidian, then copied to `quartz/styles/tenebrous.css`. Edit the SCSS over there and not this file.

On its own the CSS does very little, because it styles classes that the build adds after Quartz has run. This table lists each class, what adds it, and what it is for.

| Class | Added by | Used for |
| --- | --- | --- |
| `theme-dark`, `tenebrism`, `swirl` on `<html>`, and `home` on the home page | `build.sh` | The palette variables, the look, and the home page layout |
| `markdown-reading-view` on the note | `build.sh` | Obsidian's reading-view selectors |
| `breadcrumb` | `build.sh` | The breadcrumb line at the top of a note |
| `unresolved` | `passes/mark-links.py` | A link to a note that is not published, with a dotted underline |
| `tag-line`, `tl-<tag>` | `passes/mark-links.py` | A line that starts with a status tag, from `todo` to `question` |
| `text-highlight`, `hl-<colour>` | `passes/mark-links.py` | The colour of a highlight, picked from its emoji |
| `infobox`, `infobox-side`, `infobox-inline`, `infobox-credit` | `passes/infobox.py` | The details box beside a note, and its copy on phones |
| `site-header`, `site-header-text`, `site-social-links` | `passes/inject-chrome.py` | The site name and the social links |
| `graph-open`, `graph-close` | `passes/graph-button.py` | The graph button and its close button |
| `back-to-top`, `page-outline-mobile` | `passes/page-nav.py` | The back-to-top button, and the outline on phones |
| `base-map-embed` | `passes/bases-map.py` | The Leaflet map |
| `bases-group-heading` | `passes/bases-groups.py` | Year headings in a Bases list |
| `bases-card-image` with `--cover` | `build.sh`, `passes/card-covers.py` | The blurred cover behind a card image |
| `skip-link`, `visually-hidden` | `a11y/a11y-fix.py` | The skip link, and text for screen readers only |

The fonts, `swirl.svg` and the favicons come from the `assets` folder in Tenebrous-Obsidian, and `build.sh` copies them into `quartz/static`.
