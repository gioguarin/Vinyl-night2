#!/usr/bin/env bash
# Build the static demo for GitHub Pages: the public pages rendered from
# src/lib/demo-fixtures.ts, with the server-only surfaces (API routes, host
# console, live SSE views) stripped out. Output: .demo-build/out
#
# Usage: PAGES_BASE_PATH=/Vinyl-night2 scripts/build-demo.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD_DIR=.demo-build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

for entry in * .[!.]*; do
  [ -e "$entry" ] || continue
  case "$entry" in
    .git | node_modules | .next | "$BUILD_DIR") continue ;;
  esac
  cp -a "$entry" "$BUILD_DIR/"
done
ln -s "$(pwd)/node_modules" "$BUILD_DIR/node_modules"

# Server-only surfaces can't be statically exported.
rm -rf \
  "$BUILD_DIR/src/app/api" \
  "$BUILD_DIR/src/app/host" \
  "$BUILD_DIR/src/app/e/[slug]/live"

# Swap in the static demo pages.
cp -a demo/app/. "$BUILD_DIR/src/app/"

(cd "$BUILD_DIR" && DEMO_STATIC=1 npm run build)

# Pages' branch-based deploys run Jekyll, which ignores _next/ without this.
touch "$BUILD_DIR/out/.nojekyll"

echo "Static demo written to $BUILD_DIR/out"
