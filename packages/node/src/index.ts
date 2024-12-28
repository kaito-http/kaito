import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

interface HttpRequest {
	url: string;
	headers: Record<string, string>;
	method: string;
}

type RequestHandler = (req: HttpRequest) => string;

const addon = require('./http.node');
const {create} = addon;

// Create and start the server
const port = 8080;
const server = create();

server.listen(port, (req: HttpRequest) => {
	console.log(`${req.method} ${req.url}`);
	console.log('Headers:', JSON.stringify(req.headers, null, 2));

	return JSON.stringify(
		{
			message: 'Hello from native HTTP server!',
			received: {
				url: req.url,
				method: req.method,
				headers: req.headers,
			},
		},
		null,
		2,
	);
});

console.log(`Server listening on http://localhost:${port}`);

// Clean shutdown
process.on('SIGINT', () => {
	console.log('\nShutting down server...');
	process.exit(0);
});

// Also handle SIGTERM for the test script
process.on('SIGTERM', () => {
	console.log('\nShutting down server...');
	process.exit(0);
});
