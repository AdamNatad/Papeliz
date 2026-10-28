#!/usr/bin/env bash
set -euo pipefail

papeliz_image_to_svg_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo " [error] Node.js was not found. Install Node.js 24 LTS from https://nodejs.org, then run this again." >&2
  exit 1
fi

# Runs from the current folder, so picture and output paths may be relative to it.
exec node "$papeliz_image_to_svg_dir/../../shared/image-to-svg/papeliz-image-to-svg.mjs" "$@"
