#!/usr/bin/env bash
# Stage the published notes, build the site into public/, and make the home
# note the site root. Deploy with `wrangler deploy` (see wrangler.toml).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

# Compile the Tenebrous theme for Quartz.
THEME="${THEME_DIR:-$HOME/Developer/Tenebrous-Obsidian}"
mkdir -p theme
sass --no-source-map --charset "$THEME/src/main-quartz.scss" theme/tenebrous.css
cp theme/tenebrous.css quartz/styles/tenebrous.css

stage/stage.sh
cp "$THEME/assets/favicon/favicon-196x196.png" quartz/static/icon.png
mkdir -p quartz/static/fonts && cp "$THEME"/assets/fonts/*.woff2 quartz/static/fonts/
cp "${VAULT:-/Users/Signia/Vaults/Tenebrous}/Admin/Attachments/tenebrous-dragon.png" quartz/static/tenebrous-dragon.png
# The swirl look's picture, used by the default look.
cp "$THEME/assets/swirl.svg" quartz/static/swirl.svg
npx quartz build -d .stage

# The home note has permalink "home" and is staged as index.md, which Quartz
# serves at the site root.

# The theme's variables hang off .theme-dark. Put that class on <html> so
# they reach Quartz's root variables.
# Every build gets the tenebrism look with the swirl. TENEBRISM=1 is the preview: it
# adds a noindex tag and lets ?look=spotlight switch to the plain spotlight.
VARIANT=" tenebrism swirl"
find public -name '*.html' -exec sed -i '' "s/^<html lang=/<html class=\"theme-dark${VARIANT}\" lang=/" {} +
if [ -n "${TENEBRISM:-}" ]; then
  find public -name '*.html' -exec sed -i '' 's#<head>#<head><meta name="robots" content="noindex">#' {} +
  # ?look=spotlight swaps the swirl for the plain spotlight for the session, and
  # ?look=swirl brings it back. The class is put back after each in-site navigation.
  LOOK='<script>(function(){var k="look",q=new URLSearchParams(location.search).get(k);if(q){try{sessionStorage.setItem(k,q)}catch(e){}}var on=function(){var v;try{v=sessionStorage.getItem(k)}catch(e){}document.documentElement.classList.toggle("swirl",v!=="spotlight")};on();document.addEventListener("nav",on)})()</script>'
  find public -name '*.html' -exec perl -pi -e "s#<head>#<head>$LOOK#" {} +
fi

# The theme's selectors expect Obsidian's reading-view class on the rendered
# note, and a "home" class on the home page.
find public -name '*.html' -exec sed -i '' 's/class="markdown-preview-view markdown-rendered"/class="markdown-preview-view markdown-reading-view markdown-rendered"/g' {} +
sed -i '' 's/^<html class="theme-dark/<html class="home theme-dark/' public/index.html

# Mark the hand-written breadcrumb line (links separated by " / ") at the top
# of a note. If the note has its own # title, drop Quartz's duplicate title.
find public -name '*.html' -exec perl -0pi -e '
  s{(<div class="markdown-preview-view[^"]*">)<p>((?:<a [^>]*>[^<]*</a> / )+<a [^>]*>[^<]*</a>)</p>}{$1<p class="breadcrumb">$2</p>};
  s{<h1 class="article-title">.*?</h1>}{}s if /<div class="markdown-preview-view[^"]*">.*?<h1 id=/s;
' {} +

# Quartz keeps the whole first paragraph of a callout in its title when the
# title line holds a link, so the second line never becomes the body as it does
# in Obsidian. Split hub cards at the line break.
find public -name '*.html' -exec perl -0pi -e '
  s{(<blockquote class="callout hub-[^"]*"[^>]*>\s*<div class="callout-title">\s*<div class="callout-icon"></div>\s*<div class="callout-title-inner"><p>)([^\n]*)\n(.*?)</p></div>(\s*)</div>(\s*)</blockquote>}{$1$2</p></div>$4</div>\n<div class="callout-content">\n<p>$3</p>\n</div>$5</blockquote>}sg;
' {} +

# Give each card's cover wrapper the image URL as --cover, for the blurred
# backdrop behind the contained image.
find public -name '*.html' -exec perl -pi -e '
  s{<div class="bases-card-image"><img src="([^"]+)"}{<div class="bases-card-image" style="--cover:url(\x27$1\x27)"><img src="$1"}g;
' {} +

# The Bases plugin ignores groupBy, so add the year headings it leaves out.
python3 passes/bases-groups.py public .stage

# The graph loads d3 and pixi.js from a CDN at run time. Serve the copies in
# quartz/static/vendor instead.
find public/static/scripts -name '*.js' -exec perl -pi -e '
  s{https://cdn\.jsdelivr\.net/npm/d3\@7/dist/d3\.min\.js}{/static/vendor/d3.min.js}g;
  s{https://cdn\.jsdelivr\.net/npm/pixi\.js\@8/dist/pixi\.js}{/static/vendor/pixi.js}g;
' {} +

# Quartz's page head hard-codes a preconnect to cdnjs, which nothing here uses.
find public -name '*.html' -exec perl -pi -e 's{<link rel="preconnect" href="https://cdnjs\.cloudflare\.com"[^>]*/>}{}g' {} +

# Drop breadcrumb-only links from the graph data so Home and the hubs do not
# connect to every page.
# Drop the tag pages nobody needs, before links to them are checked.
python3 passes/tag-pages.py public .stage
python3 passes/graph-links.py public .stage

# Mark unresolved links and give coloured highlights a class per colour.
python3 passes/mark-links.py public

# Redirect old Publish paths for notes that had no permalink.
python3 passes/old-urls.py .stage public
python3 passes/tag-pages.py public .stage --redirects

# Draw the Bases map view with Leaflet, from the markers baked for Publish.
python3 passes/bases-map.py public .stage "$HOME/Developer/Tenebrous-Obsidian/src/scripts/baked-data.ts"

# Normalised, cropped thumbnails so card covers fill the card.
python3 passes/card-covers.py public

# A trip infobox, to the right of the note, from its frontmatter.
python3 passes/infobox.py public .stage

# The logo and social links come from the theme: the dragon image from the
# vault, the links from the theme's own link list.
VAULT="${VAULT:-/Users/Signia/Vaults/Tenebrous}"
mkdir -p .build
esbuild "$THEME/src/scripts/features/social-links/links.ts" --format=esm --outfile=.build/links.mjs --log-level=error
node passes/chrome.mjs "$PWD/.build/links.mjs" > .build/chrome.html
TITLE="$(sed -n 's/^  pageTitle: *//p' quartz.config.yaml | head -1)"
python3 passes/inject-chrome.py public .build/chrome.html "$TITLE"

# Obsidian calls it the outline.
find public -name '*.html' -exec perl -pi -e 's{<h3>Table of Contents</h3>}{<h3>Outline</h3>}g' {} +

# Favicons from the theme, replacing Quartz's default icon and generated .ico.
cp "$THEME"/assets/favicon/favicon-*.png public/static/
cp "$THEME/assets/favicon/favicon.ico" public/favicon.ico
ICONS='<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32x32.png"><link rel="icon" type="image/png" sizes="196x196" href="/static/favicon-196x196.png"><link rel="apple-touch-icon" sizes="152x152" href="/static/favicon-152x152.png"><link rel="apple-touch-icon" sizes="167x167" href="/static/favicon-167x167.png"><link rel="apple-touch-icon" sizes="180x180" href="/static/favicon-180x180.png">'
find public -name '*.html' -exec perl -pi -e 'BEGIN{$i=shift} s{<link rel="icon" href="[^"]*static/icon\.png"/>}{$i}g' "$ICONS" {} +

# Hub pages (the κόμβος class) and the landing page do not show the date and reading time.
find public -name '*.html' -exec perl -0pi -e 's{<p show-comma="true" class="content-meta">.*?</p>}{}s if /<article class="[^"]*(?:κόμβος|landing)/' {} +

# Show dates on cards as plain dates, not full timestamps.
find public -name '*.html' -exec perl -pi -e 's{(<span class="bases-text">\d{4}-\d{2}-\d{2})T[0-9:.+-Z]*(</span>)}{$1$2}g' {} +

# A graph button beside the search bar.
python3 passes/graph-button.py public

# A back-to-top button and a phone outline.
python3 passes/page-nav.py public

# Accessibility fixes (landmarks, language, labels), last so it sees the final markup.
python3 a11y/a11y-fix.py public

# Footer links and the feed link.
python3 passes/footer-links.py public

# The home page's sidebar links.
python3 passes/home-links.py public
