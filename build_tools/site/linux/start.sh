#!/usr/bin/env bash
set -euo pipefail

papeliz_launcher_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
papeliz_repository_root="$(cd -- "$papeliz_launcher_dir/../../.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo " [error] Node.js was not found. Install Node.js 24 LTS from https://nodejs.org, then run this again." >&2
  exit 1
fi

cd "$papeliz_repository_root"
exec node build_tools/shared/launcher/papeliz-launcher.mjs site start linux "$@"
