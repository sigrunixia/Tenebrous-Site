#!/usr/bin/env bash
# Writes scss/_callout-icons.scss from callout-icons.txt (a callout type and its Lucide icon per line), fetching
# each icon from Lucide once. Run it after editing the list, and commit the result.
set -euo pipefail
cd "$(dirname "$0")"
deno run --allow-read --allow-write --allow-net icons.js
