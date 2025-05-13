// fake typing deno
declare const Deno: {serve: (options: {port: number}, handler: (req: Request) => Promise<Response>) => {}};

import {create} from '@kaito-http/core';

const start = performance.now();

const router = create({
	getContext: req => ({
		req,
		uptime: performance.now() - start,
	}),
	onError: error => ({
		status: 500,
		message: error.message,
	}),
});

const fetch = router
	.get('/', () => 'hey')
	.post('/', () => 'hey2')
	.post('/2', () => 'hey2')
	.openapi({
		info: {
			version: '1.0.0',
			title: 'My API',
			description: 'My API description',
		},
		servers: {
			'http://localhost:3000': 'Localhost',
		},
	})
	.serve();

const response = await fetch(new Request('http://localhost:3000/openapi.json'));

console.log(await response.json());

// const app = router.get('/', () => 'hello from Deno.serve()');

// Deno.serve({port: 3000}, app.serve());

// export type App = typeof app;
