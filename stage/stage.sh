#!/usr/bin/env bash
# Copy only the published notes, and the files they embed, from the Tenebrous
# vault into .stage/ so Quartz never reads an unpublished note.
#
# A note is published when its frontmatter has `publish: true`. Dot folders
# (.trash, .obsidian) and Admin/Templates and Admin/Legends are skipped, the
# same as Obsidian Publish does.
set -euo pipefail

VAULT="${VAULT:-/Users/Signia/Vaults/Tenebrous}"
HERE="$(cd "$(dirname "$0")" && pwd)"
STAGE="$HERE/../.stage"

rm -rf "$STAGE"
mkdir -p "$STAGE"

notes=()
while IFS= read -r -d '' f; do
  if awk 'NR==1 && $0!="---" {exit} NR>1 && $0=="---" {exit} NR>1 {print}' "$f" | grep -qE '^publish: *true *$'; then
    notes+=("$f")
  fi
done < <(find "$VAULT" \
  \( -name '.*' -o -path "$VAULT/Admin/Templates" -o -path "$VAULT/Admin/Legends" \) -prune -o \
  -type f -name '*.md' -print0)

echo "Published notes: ${#notes[@]}"
[ "${#notes[@]}" -gt 0 ] || { echo "No published notes found" >&2; exit 1; }

copy() {
  local src="$1" rel
  rel="${src#"$VAULT"/}"
  mkdir -p "$STAGE/$(dirname "$rel")"
  cp -p "$src" "$STAGE/$rel"
}

for n in "${notes[@]}"; do
  copy "$n"
done

# Make each permalink the page's URL, rewrite links to match, and drop aliases
# that would overwrite a page with a redirect.
python3 "$HERE/stage-permalinks.py" "$STAGE"

# The contact cards repeat the sidebar links, so leave them out.
python3 "$HERE/stage-contact.py" "$STAGE"

# A page per place, listing its trips, so a trip's Where has somewhere to link.
python3 "$HERE/stage-places.py" "$STAGE"

# A page per type and category, and the site map index that lists them.
python3 "$HERE/stage-types.py" "$STAGE"
python3 "$HERE/stage-sitemap.py" "$STAGE"

# Rewrite Bases filters and formulas the plugin cannot evaluate.
python3 "$HERE/stage-bases.py" "$STAGE"

# Optional banner at the top of the home note. Delete notice.md to remove it.
if [ -f "$HERE/notice.md" ]; then
  home="$STAGE/index.md"
  awk -v notice="$HERE/notice.md" '
    NR==1 && $0=="---" {fm=1; print; next}
    fm && $0=="---" {fm=0; print; while ((getline line < notice) > 0) print line; next}
    {print}' "$home" > "$home.tmp" && mv "$home.tmp" "$home"
fi

# Embedded files, cover images and linked canvases. Obsidian matches names
# case-insensitively, so match the same way.
refs=$(for n in "${notes[@]}"; do
  grep -hoE '!\[\[[^]|#]+|^cover: *"?\[\[[^]|#]+|\[\[[^]|#]+\.canvas' "$n" || true
done | sed -E 's/^!?\[\[//; s/^cover: *"?\[\[//' | sort -u)

missing=0
stage_ref() {
  local ref="$1" base hit
  base="$(basename "$ref")"
  hit=$(find "$VAULT" -name '.*' -prune -o -type f -iname "$base" -print -quit)
  if [ -n "$hit" ]; then
    copy "$hit"
    case "$hit" in
      *.canvas)
        # A canvas also needs the files its nodes point at. Notes are not
        # staged this way, so a canvas cannot publish an unpublished note.
        while IFS= read -r node; do
          [ -z "$node" ] && continue
          case "$node" in
            *.md) echo "Skipped note in canvas $base: $node" >&2 ;;
            *) if [ -f "$VAULT/$node" ]; then copy "$VAULT/$node"
               else echo "Missing canvas file in $base: $node" >&2; missing=$((missing + 1)); fi ;;
          esac
        done < <(grep -oE '"file": *"[^"]*"' "$hit" | sed -E 's/^"file": *"//; s/"$//' | sort -u)
        ;;
    esac
  else
    echo "Missing file for embed: $ref" >&2
    missing=$((missing + 1))
  fi
}

while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  case "$ref" in *.*) stage_ref "$ref" ;; esac   # note embeds have no extension
done <<< "$refs"

echo "Staged to $STAGE ($(find "$STAGE" -type f | wc -l | tr -d ' ') files, $missing missing)"

# Quartz compares links as raw text, so list.contains(link("Name")) never
# matches. Rewrite it to a substring test on the joined list, in the staged
# copies only.
while IFS= read -r -d '' f; do
  perl -pi -e 's/\b(\w+)\.contains\(link\("([^"]+)"\)\)/$1.join(",").contains("$2")/g' "$f"
done < <(find "$STAGE" -type f \( -name '*.md' -o -name '*.base' \) -print0)

# The Bases plugin cannot compare a date property with today() or read
# started.year, though it compares strings and date(x).year fine. Rewrite both
# in the staged copies, using the build date for today().
TODAY="$(date +%Y-%m-%d)"
while IFS= read -r -d '' f; do
  perl -pi -e '
    s/\b(\w+) (<=|>=|<|>) today\(\)/$1.toString() $2 "'"$TODAY"'"/g;
    s/\b(started|ended)\.year\b/date($1).year/g;
  ' "$f"
done < <(find "$STAGE" -type f \( -name '*.md' -o -name '*.base' \) -print0)
