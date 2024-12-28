#!/bin/bash

# Build the native module
./build.sh

echo "Starting server..."
# Run the server in the background, redirecting output to a file
node --experimental-strip-types index.ts > server.log 2>&1 &
SERVER_PID=$!

echo "Waiting for server to start (PID: $SERVER_PID)..."
# Wait for server to start and show log in real-time
tail -f server.log &
TAIL_PID=$!
sleep 5

echo "Making request to server..."
# Make a request with a timeout
curl -v --max-time 10 http://localhost:8080/test

# Wait a bit to see the response handling
sleep 2

# Kill the tail process
kill $TAIL_PID

echo "Cleaning up..."
# Kill the server and remove log
kill -9 $SERVER_PID 2>/dev/null || true
rm server.log 