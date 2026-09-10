#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "FORMANT installer"
if ! command -v node >/dev/null 2>&1 && command -v brew >/dev/null 2>&1; then
  brew install node@22 || true
  brew link --overwrite --force node@22 || true
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.12+ is required: https://nodejs.org"
  read -r -p "Press Return to close..."
  exit 1
fi
npm ci
npm run build
node scripts/launch.mjs
echo "FORMANT is ready at http://127.0.0.1:4317"
read -r -p "Press Return to close..."
