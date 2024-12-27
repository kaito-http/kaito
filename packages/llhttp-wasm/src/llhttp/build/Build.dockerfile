FROM node:20-alpine

# Install required build tools
RUN apk add --no-cache \
    clang \
    lld \
    wasi-sdk \
    git \
    python3 \
    build-base

WORKDIR /build

RUN git clone https://github.com/TheLDB/llhttp.git .

# Install dependencies
RUN npm ci
RUN mkdir -p build/wasm

CMD ["npm", "run", "wasm"]