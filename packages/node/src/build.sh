#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$DIR/../../../" && pwd)"
NODE_INCLUDE=$(node --no-warnings -p "require('node:os').type() === 'Windows_NT' ? process.execPath + '/../include/node' : process.execPath + '/../../include/node'")

# Compile llhttp with LLHTTP_IMPLEMENTATION
clang -c -DLLHTTP_IMPLEMENTATION \
  "$ROOT_DIR/deps/llhttp/build/c/llhttp.c" \
  -I"$ROOT_DIR/deps/llhttp/build"

# Then compile our C++ code and link with object files
clang++ -shared -fPIC -undefined dynamic_lookup \
  "$DIR/server.cc" \
  ./*.o \
  -I"$ROOT_DIR/deps/llhttp/build" \
  -I"$(node -p "require('node-api-headers').include_dir")" \
  -I"$NODE_INCLUDE" \
  -I"$DIR/../libuv/include" \
  -o "$DIR/http.node" \
  -pthread

chmod +x "$DIR/http.node"
rm ./*.o