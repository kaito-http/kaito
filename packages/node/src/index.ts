import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

console.log('[JS] Loading addon...');
const addon = require('./http.node');
console.log('[JS] Addon loaded successfully');

console.log('[JS] Creating server...');
const server = addon.create();
console.log('[JS] Server created successfully');

console.log('[JS] Setting up server...');
server.listen(3000, (request: any) => {
	console.log('[JS] Received request in callback:', request);
	console.log('[JS] Request headers:', request?.headers);
	console.log('[JS] Request method:', request?.method);
	console.log('[JS] Request url:', request?.url);
	console.log('[JS] Request body:', request?.body);

	// Send response back to client
	if (typeof request?.respond === 'function') {
		console.log('[JS] Sending response...');
		request.respond({
			status: 200,
			body: 'Hello, World!',
		});
		console.log('[JS] Response sent');
	} else {
		console.error('[JS] No respond method available on request object');
		console.error('[JS] Request object:', request);
	}
});

console.log('Server listening on http://localhost:3000');

// Keep the event loop alive and monitor server state
const timer = setInterval(() => {
	const serverRef = (global as any)._http_server;
	console.log('[DEBUG] Event loop tick - server ref:', !!serverRef);

	// Check if server is still alive
	if (!serverRef) {
		console.log('[DEBUG] Server reference lost, stopping timer');
		clearInterval(timer);
	}
}, 1000);

// Prevent the process from exiting
process.stdin.resume();

// Store server reference in global scope
(global as any)._http_server = server;
console.log('[JS] Server reference stored in global');
