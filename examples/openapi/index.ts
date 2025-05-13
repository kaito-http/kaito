import {create, k} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {KaitoServer} from '@kaito-http/uws';

const router = create({
	getContext: (req, head) => ({req, head}),
	onError: error => ({status: 500, message: error.message}),
});

const root = router
	.post('/hello/:user_id', {
		openapi: {
			description: 'Hello world',
			body: {
				type: 'json',
				description: 'A user object',
				schema: k.object({
					body: k.string(),
					query: k.object({
						name: k.string(),
					}),
				}),
			},
		},
		body: k.string(),
		query: {
			name: k.string(),
		},
		run: async ({body, query}) => ({
			body,
			query,
		}),
	})
	.get('/stream', {
		openapi: {
			body: {
				type: 'sse',
				schema: k.object({
					data: k.string(),
					event: k.literal('cool'),
					retry: k.number(),
				}),
			},
		},
		run: async () => {
			const text = "This is an example of text being streamed every 100ms by using Kaito's sse() function";

			return sse(async function* () {
				for (const word in text.split(' ')) {
					yield {data: word, event: 'cool', retry: 1000};
				}
			});
		},
	})
	.through(async ctx => {
		if (ctx.req.headers.get('x-api-key') !== '123') {
			throw new Error('No API key provided');
		}

		return ctx;
	})
	.openapi({
		info: {
			version: '1.0.0',
			title: 'Kaito API',
			description: 'API for the Kaito framework',
		},
		servers: {
			'http://localhost:3000': 'Localhost development server',
		},
	});

const server = await KaitoServer.serve({
	fetch: root.serve(),
	port: 3000,
	host: '127.0.0.1',
	static: {
		'/static/file.txt': new Response('Hello, world!'),
	},
});

console.log('Server listening at', server.url);

export type App = typeof root;
