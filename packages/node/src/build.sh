#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd $DIR/../../../ && pwd)"
NODE_INCLUDE=$(node --no-warnings -p "require('node:os').type() === 'Windows_NT' ? process.execPath + '/../include/node' : process.execPath + '/../../include/node'")

clang++ -shared -fPIC \
  $DIR/server.cc \
  $ROOT_DIR/deps/llhttp/build/c/llhttp.c \
  -I$ROOT_DIR/deps/llhttp/build \
  -I$DIR/../libuv/include \
  -I$(node -p "require('node-api-headers').include_dir") \
  -I$NODE_INCLUDE \
  -o $DIR/http.node \
  -pthread

chmod +x $DIR/http.node