#!/usr/bin/env bash
# X-Grid installer / updater for macOS.
# Installs the latest signed release into the current user's CEP extensions
# folder (no admin rights, no debug mode). Run it again to update.
#
#   curl -fsSL https://raw.githubusercontent.com/sadekdesign/X-Grid/main/install/install.sh | bash
#
# Optional: XGRID_ZXP=/path/X-Grid.zxp installs that file instead of downloading.
set -euo pipefail

repo="sadekdesign/X-Grid"
bundle="com.xoutput.xgrid"
dest="$HOME/Library/Application Support/Adobe/CEP/extensions/$bundle"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [ -n "${XGRID_ZXP:-}" ]; then
  zxp="$XGRID_ZXP"; version="local file"
else
  echo "Looking up the latest X-Grid release..."
  json="$(curl -fsSL -H 'User-Agent: xgrid-installer' "https://api.github.com/repos/$repo/releases/latest")"
  url="$(printf '%s' "$json" | grep -o '"browser_download_url": *"[^"]*\.zxp"' | head -n1 | sed 's/.*"\(https[^"]*\)"/\1/')"
  version="$(printf '%s' "$json" | grep -o '"tag_name": *"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
  [ -n "$url" ] || { echo "The latest release has no .zxp file." >&2; exit 1; }
  zxp="$tmp/X-Grid.zxp"
  curl -fsSL "$url" -o "$zxp"
fi

# a .zxp is a signed zip: unpack it as-is so the signature stays valid
unzip -q "$zxp" -d "$tmp/unpacked"
[ -f "$tmp/unpacked/CSXS/manifest.xml" ] || { echo "This file is not an X-Grid extension." >&2; exit 1; }

mkdir -p "$(dirname "$dest")"
rm -rf "$dest"
mv "$tmp/unpacked" "$dest"

echo
echo "X-Grid $version installed to $dest"
if pgrep -xq "Adobe Illustrator"; then echo "Restart Illustrator to load it."; fi
echo "Open it from Window > Extensions > X-Grid."
