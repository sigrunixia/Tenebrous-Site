#!/usr/bin/env bash
# Compiles the stylesheet with brew's sass (scss/main.scss into src/site.css), then builds the site.
# The shared theme comes from Tenebrous-Obsidian and the site colours are in scss/site, so no colour is written here.
set -euo pipefail
cd "$(dirname "$0")"
DEV="${DEV:-$HOME/Developer}"
sass --no-source-map --style=compressed \
  --load-path=scss --load-path="$DEV/Tenebrous-Obsidian/src" --load-path=scss/site \
  scss/main.scss src/site.css
deno task build "$@"
