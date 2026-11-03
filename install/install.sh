#!/usr/bin/env bash
# X-Grid installer / updater for macOS.
# Installs the latest signed release into the current user's CEP extensions
# folder (no admin rights, no debug mode). Run it again to update.
#
#   curl -fsSL https://x-output.com/lab/x-grid/install.sh | bash
#
# Optional: XGRID_ZXP=/path/X-Grid.zxp installs that file instead of downloading.
#           XGRID_BASE=http://localhost:3000/lab/x-grid downloads from another host (testing).
set -euo pipefail

base="${XGRID_BASE:-https://x-output.com/lab/x-grid}"
base="${base%/}"
bundle="com.xoutput.xgrid"
dest="$HOME/Library/Application Support/Adobe/CEP/extensions/$bundle"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [ -n "${XGRID_ZXP:-}" ]; then
  zxp="$XGRID_ZXP"
else
  echo "Downloading the latest X-Grid..."
  zxp="$tmp/X-Grid.zxp"
  curl -fsSL "$base/X-Grid.zxp" -o "$zxp"
fi

# a .zxp is a signed zip: unpack it as-is so the signature stays valid
unzip -q "$zxp" -d "$tmp/unpacked"
[ -f "$tmp/unpacked/CSXS/manifest.xml" ] || { echo "This file is not an X-Grid extension." >&2; exit 1; }
version="$(grep -o 'ExtensionBundleVersion="[^"]*"' "$tmp/unpacked/CSXS/manifest.xml" | head -n1 | cut -d'"' -f2)"

mkdir -p "$(dirname "$dest")"
rm -rf "$dest"
mv "$tmp/unpacked" "$dest"

echo
echo "X-Grid $version installed to $dest"
if pgrep -xq "Adobe Illustrator"; then echo "Restart Illustrator to load it."; fi
echo "Open it from Window > Extensions > X-Grid."
