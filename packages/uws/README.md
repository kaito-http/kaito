# @kaito-http/uws

A high-performance Request/Response Web Fetch API based Node.js-only HTTP server using [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js).

## Features

- High-performance HTTP server using uWebSockets.js
- Full Web Standards API compatibility (Request/Response)
- Automatic request abortion handling via AbortSignal
- Client IP address access
- Streaming request and response support

## Installation

```bash
bun i @kaito-http/uws
```

## Basic Usage

```typescript
import {KaitoServer} from '@kaito-http/uws';

const server = await KaitoServer.serve({
	port: 3000,
	fetch: async request => {
		return new Response('Hello World!');
	},
});

console.log(`Server running at ${server.url}`);
```

## Request Signal Support

The server automatically provides an `AbortSignal` on each request that gets triggered when the client disconnects:

```typescript
import {KaitoServer} from '@kaito-http/uws';

const server = await KaitoServer.serve({
	port: 3000,
	fetch: async request => {
		// The request.signal is automatically set up
		console.log('Request signal aborted:', request.signal.aborted);

		// Listen for client disconnection
		request.signal.addEventListener('abort', () => {
			console.log('Client disconnected, cleaning up...');
			// Clean up resources, cancel operations, etc.
		});

		// Simulate long-running operation
		return new Promise(resolve => {
			const timeout = setTimeout(() => {
				resolve(new Response('Operation completed'));
			}, 5000);

			// Cancel operation if client disconnects
			request.signal.addEventListener('abort', () => {
				clearTimeout(timeout);
				console.log('Operation cancelled due to client disconnect');
			});
		});
	},
});
```

## Remote Address Access

Get the client's IP address using the `getRemoteAddress()` function:

```typescript
import {KaitoServer, getRemoteAddress} from '@kaito-http/uws';

const server = await KaitoServer.serve({
	port: 3000,
	fetch: async request => {
		// This only works inside the fetch handler or nested functions
		const clientIP = getRemoteAddress();
		console.log(`Request from: ${clientIP}`);

		return new Response(`Your IP is: ${clientIP}`);
	},
});
```

## Server Configuration

```typescript
import {KaitoServer} from '@kaito-http/uws';

const server = await KaitoServer.serve({
	port: 3000,
	host: '127.0.0.1', // defaults to '0.0.0.0'
	fetch: async request => {
		// Your request handler
		return new Response('Hello!');
	},
});

// Server properties
console.log('Server address:', server.address); // "127.0.0.1:3000"
console.log('Server URL:', server.url); // "http://127.0.0.1:3000"

// Close the server
server.close();
```
