#!/usr/bin/env bash
# Builds Lambda deployment zips for the load and query functions.
#
# psycopg2-binary ships C extensions, so it must be the manylinux wheel built
# for Lambda's runtime (Amazon Linux, x86_64) — not whatever wheel `pip
# install` would pick on this machine. We download it explicitly with
# --platform/--python-version/--abi instead of relying on the local
# interpreter's platform.
set -euo pipefail

RUNTIME_PY_VERSION="3.12"
RUNTIME_ABI="cp312"
PLATFORM="manylinux2014_x86_64"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$HERE/build"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

build_package() {
    local name="$1"
    local pkg_dir="$BUILD_DIR/$name"
    mkdir -p "$pkg_dir"
    # --platform/--python-version/--abi force pip to fetch (and accept) the
    # Lambda-runtime wheel regardless of the host interpreter's own platform.
    python3 -m pip install psycopg2-binary \
        --platform "$PLATFORM" \
        --python-version "$RUNTIME_PY_VERSION" \
        --implementation cp \
        --abi "$RUNTIME_ABI" \
        --only-binary=:all: \
        --no-deps \
        --target "$pkg_dir" \
        --quiet
    cp "$HERE/$name/handler.py" "$pkg_dir/"
    ( cd "$pkg_dir" && zip -r -q "$BUILD_DIR/${name}_function.zip" . -x "*.dist-info/*" )
    echo "Built $BUILD_DIR/${name}_function.zip ($(du -h "$BUILD_DIR/${name}_function.zip" | cut -f1))"
}

build_package load
build_package query
