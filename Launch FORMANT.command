#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22.12 or newer from https://nodejs.org, then reopen this launcher."
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
if [ ! -f dist/index.html ]; then npm run build; fi
node scripts/launch.mjs
