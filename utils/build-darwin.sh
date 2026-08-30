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

assert_build_toolchain() {
    local node_version npm_version node_major node_minor npm_major

    if ! node_version="$(node --version)"; then
        echo "ERROR: Unable to run Node.js. Install Node.js 22.13.0 or newer, then reopen the terminal." >&2
        exit 1
    fi

    if ! npm_version="$(npm --version)"; then
        echo "ERROR: Unable to run npm. Install Node.js 22.13.0 or newer, then reopen the terminal." >&2
        exit 1
    fi

    node_major="${node_version#v}"
    node_major="${node_major%%.*}"
    node_minor="${node_version#v}"
    node_minor="${node_minor#*.}"
    node_minor="${node_minor%%.*}"
    npm_major="${npm_version%%.*}"
    echo "Using Node.js $node_version and npm $npm_version"

    if ! [[ "$node_major" =~ ^[0-9]+$ && "$node_minor" =~ ^[0-9]+$ && "$npm_major" =~ ^[0-9]+$ ]] || (( node_major < 22 || (node_major == 22 && node_minor < 13) || npm_major < 9 )); then
        echo "ERROR: This build requires Node.js 22.13.0+ and npm 9+ (found Node.js $node_version and npm $npm_version). Install Node.js 22.13.0 or newer, then reopen the terminal." >&2
        exit 1
    fi
}

# Verifies release builds do not package debug mode.
assert_release_debug_mode_disabled() {
    if ! rg -q '^[[:space:]]*const[[:space:]]+debugMode[[:space:]]*=[[:space:]]*false[[:space:]]*;[[:space:]]*$' "$PROJECT_DIR/js/main.js"; then
        echo "ERROR: debugMode is enabled! Change it in main.js." >&2
        exit 1
    fi
}

cd "$PROJECT_DIR"

assert_build_toolchain
assert_release_debug_mode_disabled

echo "Installing locked dependencies"
npm ci

echo "Preparing release artifact paths"
mkdir -p "$RELEASE_DIR"
rm -rf "$PACKAGE_DIR"
rm -f "$ARTIFACT"

echo "Packaging $APP_NAME for macOS $ARCH"
node "$PROJECT_DIR/node_modules/@electron/packager/bin/electron-packager.mjs" \
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
