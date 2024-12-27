#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd $DIR/../../../ && pwd)"
LLHTTP_DIR="$ROOT_DIR/deps/llhttp/build/c"
NODE_INCLUDE=$(node --no-warnings -p "require('node:os').type() === 'Windows_NT' ? process.execPath + '/../include/node' : process.execPath + '/../../include/node'")

echo $NODE_INCLUDE

clang++ -shared -fPIC \
  $DIR/server.cc \
  -I$LLHTTP_DIR \
  -I$(node -p "require('node-api-headers').include_dir") \
  -I$NODE_INCLUDE \
  -o http.node \
  -pthread

chmod +x $DIR/http.node