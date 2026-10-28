#!/usr/bin/env bash
set -euo pipefail

papeliz_strip_image_metadata_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo " [error] Node.js was not found. Install Node.js 24 LTS from https://nodejs.org, then run this again." >&2
  exit 1
fi

# Runs from the current folder, so file and folder paths may be relative to it.
exec node "$papeliz_strip_image_metadata_dir/../../shared/image-metadata/papeliz-strip-image-metadata.mjs" "$@"
