#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -x "$HOME/.formant/node/bin/node" ]; then export PATH="$HOME/.formant/node/bin:$PATH"; fi
if ! command -v node >/dev/null 2>&1; then
  echo "Double-click Install FORMANT.app to install the private runtime first."
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
if [ ! -f dist/index.html ]; then npm run build; fi
node scripts/launch.mjs
