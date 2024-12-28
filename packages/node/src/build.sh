#!/bin/bash

# Exit on error
set -e

# Get directory of script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_ROOT="$DIR/../../../"
LIBUV_DIR="$DIR/../libuv"
LLHTTP_DIR="$WORKSPACE_ROOT/deps/llhttp"

# Build libuv if needed
if [ ! -f "$LIBUV_DIR/.libs/libuv.a" ]; then
    echo "Building libuv..."
    cd "$LIBUV_DIR"
    ./autogen.sh
    ./configure
    make -j$(nproc)
    cd "$DIR"
fi

# Build llhttp if needed
if [ ! -f "$LLHTTP_DIR/build/libllhttp.a" ]; then
    echo "Building llhttp..."
    cd "$LLHTTP_DIR"
    make
    cd "$DIR"
fi

# Ensure we're in the right directory
cd "$DIR"

# Get node paths
NODE_PREFIX=$(node -e "console.log(process.execPath)")
NODE_INCLUDE_DIR=$(node -e "console.log(require('node-api-headers').include_dir)")

# Compiler and flags
CXX="clang++"
CXXFLAGS="-std=c++17 -fPIC -O3"

# Include paths
INCLUDES=(
  "-I$NODE_INCLUDE_DIR"
  "-I$WORKSPACE_ROOT/node_modules/node-api-headers/include"
  "-I$WORKSPACE_ROOT/deps/llhttp/build"
  "-I$WORKSPACE_ROOT/packages/node/libuv/include"
)

# Library paths and libs to link
LDFLAGS=(
  "$LIBUV_DIR/.libs/libuv.a"  # Static link libuv
  "$LLHTTP_DIR/build/libllhttp.a"  # Static link llhttp
)

# Platform specific flags
if [[ "$OSTYPE" == "darwin"* ]]; then
  # On macOS, link against node binary directly
  LDFLAGS+=("-Wl,-bundle_loader,$NODE_PREFIX")
  LDFLAGS+=("-bundle")
else
  # Linux and others use shared library
  LDFLAGS+=("-shared")
  LDFLAGS+=("-lnode")
fi

# Output file
OUTPUT="http.node"

# Build command
$CXX $CXXFLAGS "${INCLUDES[@]}" \
  -o "$OUTPUT" \
  server.cc \
  "${LDFLAGS[@]}"

# Make executable
chmod +x "$OUTPUT"

echo "Built $OUTPUT successfully"
