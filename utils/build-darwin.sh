#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$PROJECT_DIR/release-builds"
APP_NAME="Mini4wdChrono"
PLATFORM="darwin"
ARCH="x64"
PACKAGE_DIR="$RELEASE_DIR/$APP_NAME-$PLATFORM-$ARCH"
ARTIFACT="$RELEASE_DIR/Mini4wdChrono-mac-x64.zip"

cd "$PROJECT_DIR"

echo "Installing locked dependencies"
npm ci

echo "Preparing release artifact paths"
mkdir -p "$RELEASE_DIR"
rm -rf "$PACKAGE_DIR"
rm -f "$ARTIFACT"

echo "Packaging $APP_NAME for macOS $ARCH"
node "$PROJECT_DIR/node_modules/electron-packager/bin/electron-packager.js" \
    "$PROJECT_DIR" "$APP_NAME" \
    --platform="$PLATFORM" \
    --arch="$ARCH" \
    --overwrite \
    --icon="$PROJECT_DIR/images/ic_launcher_web.icns" \
    --prune=true \
    --out="$RELEASE_DIR"

if [[ ! -d "$PACKAGE_DIR" ]]; then
    echo "ERROR: Expected packaged app directory was not created: $PACKAGE_DIR" >&2
    exit 1
fi

echo "Creating GitHub Release artifact: $(basename "$ARTIFACT")"
ditto -c -k --sequesterRsrc --keepParent "$PACKAGE_DIR" "$ARTIFACT"

echo "Done: $ARTIFACT"
