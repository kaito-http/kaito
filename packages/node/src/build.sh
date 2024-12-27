#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$DIR/../../../" && pwd)"
NODE_INCLUDE=$(node --no-warnings -p "require('node:os').type() === 'Windows_NT' ? process.execPath + '/../include/node' : process.execPath + '/../../include/node'")
LIBUV_DIR="$DIR/../libuv/.libs"

# Compile llhttp with LLHTTP_IMPLEMENTATION
clang -c -fPIC -DLLHTTP_IMPLEMENTATION \
  "$ROOT_DIR/deps/llhttp/build/c/llhttp.c" \
  -I"$ROOT_DIR/deps/llhttp/build"

# Compile llhttp API
cat > llhttp_api.c << 'EOL'
#include "llhttp.h"
#include <stdio.h>
#include <string.h>

// Required llhttp callbacks
int llhttp__on_message_begin(llhttp__internal_t* s) {
    printf("llhttp__on_message_begin called\n");
    return 0;
}

int llhttp__on_url(llhttp__internal_t* s, const unsigned char* at, size_t length) {
    printf("llhttp__on_url called\n");
    return 0;
}

int llhttp__on_status(llhttp__internal_t* s, const unsigned char* at, size_t length) {
    printf("llhttp__on_status called\n");
    return 0;
}

int llhttp__on_header_field(llhttp__internal_t* s, const unsigned char* at, size_t length) {
    printf("llhttp__on_header_field called\n");
    return 0;
}

int llhttp__on_header_value(llhttp__internal_t* s, const unsigned char* at, size_t length) {
    printf("llhttp__on_header_value called\n");
    return 0;
}

int llhttp__on_headers_complete(llhttp__internal_t* s) {
    printf("llhttp__on_headers_complete called\n");
    return 0;
}

int llhttp__on_body(llhttp__internal_t* s, const unsigned char* at, size_t length) {
    printf("llhttp__on_body called\n");
    return 0;
}

int llhttp__on_message_complete(llhttp__internal_t* s) {
    printf("llhttp__on_message_complete called\n");
    return 0;
}

int llhttp__on_protocol(llhttp__internal_t* s, const unsigned char* at, size_t length) {
    printf("llhttp__on_protocol called\n");
    return 0;
}

int llhttp__on_version(llhttp__internal_t* s, const unsigned char* at, size_t length) {
    printf("llhttp__on_version called\n");
    return 0;
}

int llhttp__on_method(llhttp__internal_t* s, const unsigned char* at, size_t length) {
    printf("llhttp__on_method called\n");
    return 0;
}

int llhttp__before_headers_complete(llhttp__internal_t* s) {
    printf("llhttp__before_headers_complete called\n");
    return 0;
}

int llhttp__after_headers_complete(llhttp__internal_t* s) {
    printf("llhttp__after_headers_complete called\n");
    return 0;
}

int llhttp__after_message_complete(llhttp__internal_t* s) {
    printf("llhttp__after_message_complete called\n");
    return 0;
}
EOL

# Compile our API implementation
clang -c -fPIC llhttp_api.c \
  -I"$ROOT_DIR/deps/llhttp/build"

# Then compile our C++ code and link with object files
clang++ -shared -fPIC -undefined dynamic_lookup \
  "$DIR/server.cc" \
  llhttp.o \
  llhttp_api.o \
  -I"$ROOT_DIR/deps/llhttp/build" \
  -I"$(node -p "require('node-api-headers').include_dir")" \
  -I"$NODE_INCLUDE" \
  -I"$DIR/../libuv/include" \
  "$LIBUV_DIR/libuv.a" \
  -o "$DIR/http.node" \
  -pthread

chmod +x "$DIR/http.node"
rm ./*.o llhttp_api.c