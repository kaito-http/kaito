#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[BASH] Building addon..."
pushd "$DIR" >/dev/null
./build.sh
popd >/dev/null

echo "[BASH] Starting Node server in background..."
timeout 10 node --experimental-strip-types "$DIR/index.ts" &
NODE_PID=$!

# Give the server a moment to start
echo "[BASH] Waiting for server to start..."
sleep 2

# Try curling the server
echo "[BASH] Curling port 3000..."
curl -v http://localhost:3000 || true

# Wait for a bit to see output
echo "[BASH] Waiting for output..."
sleep 2

echo "[BASH] Stopping Node server..."
kill $NODE_PID 2>/dev/null || true
wait $NODE_PID 2>/dev/null || true

echo "[BASH] Done."
exit 0 