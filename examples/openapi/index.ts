import {create, k} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {KaitoServer} from '@kaito-http/uws';

const router = create({
	getContext: (req, head) => ({req, head}),
	onError: error => ({status: 500, message: error.message}),
});

export const NodeId = k
	.scalar<string, bigint>({
		schema: k.string(),
		toClient: v => `node_${v}`,
		toServer: v => {
			const [_, id] = v.split('_');

			return BigInt(id!);
		},
	})
	.description('The unique identifier for an uptime node')
	.example('node_1234567890abcdef');

const root = router
	.post('/', {
		openapi: {
			type: 'json',
			schema: k.object({someId: NodeId}),
		},
		body: k.object({
			nodeId: NodeId,
		}),
		async run({body}) {
			console.log(body);
			return {someId: BigInt(2345)};
		},
	})
	.post('/hello/:user_id', {
		openapi: {
			type: 'json',
			schema: k.object({
				body: k.string(),
				query: k.object({
					name: k.string(),
				}),
			}),
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
			type: 'sse',
		},
		run: async () => {
			const text = "This is an example of text being streamed every 100ms by using Kaito's sse() function";

			const result = sse(async function* () {
				for (const word in text.split(' ')) {
					yield {data: word, event: 'cool2', retry: 1000};
				}
			});

			return result;
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
});

console.log('Server listening at', server.url);

export type App = typeof root;

// Client usage example - demonstrates that body.nodeId is typed as string (the input type)
import {createKaitoHTTPClient} from '@kaito-http/client';

const client = createKaitoHTTPClient<App>({base: 'http://localhost:3000'});

const response = await client.post('/', {
	body: {
		nodeId: 'node_123', // string, not bigint (scalar input type)
	},
});

// response.someId is string (scalar input type), not bigint (server type)
const someId: string = response.someId;
console.log(someId);
