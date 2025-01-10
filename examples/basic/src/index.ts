import {createKaitoHandler, KaitoError} from '@kaito-http/core';
import {KaitoServer} from '@kaito-http/uws';
import {default as Stripe, default as stripe} from 'stripe';
import {z} from 'zod';
import {getContext, router} from './context.ts';
import {sse} from '@kaito-http/core/stream';
import {randomEvent} from './data.ts';

async function sleep(ms: number) {
	await new Promise(resolve => setTimeout(resolve, ms));
}

const users = router()
	.post('/:id', {
		body: z.object({
			name: z.string(),
		}),

		query: {
			limit: z
				.string()
				.transform(value => parseInt(value, 10))
				.default('10'),
			skip: z.string().transform(value => parseInt(value, 10)),
		},

		async run({ctx, body, params, query}) {
			return {
				uptime: ctx.uptime,
				body,
				params,
				query,
			};
		},
	})
	.post('/set-me-a-cookie', async ({ctx}) => {
		ctx.cookie('ThisIsACookie', 'ThisIsAValue', {
			expires: /* in a day */ new Date(Date.now() + 1000 * 60 * 60 * 24),
		});
	});

const webCrypto = Stripe.createSubtleCryptoProvider();
const exampleHandlingStripe = router().post('/webhook', async ({ctx}) => {
	const body = await ctx.req.text();

	const sig = ctx.req.headers.get('stripe-signature');

	if (!sig) {
		throw new KaitoError(400, 'No signature provided');
	}

	const event = await stripe.webhooks.constructEventAsync(
		body,
		sig,
		process.env.STRIPE_ENDPOINT_SECRET!, // You should validate this exists, and not use the `!` operator
		undefined,
		webCrypto,
	);

	console.log('Stripe event:', event);
});

const exampleReturningResponse = router()
	.get('/', async () => {
		return new Response('Hello world', {
			status: 200,
			headers: {
				'Content-Type': 'text/plain',
			},
		});
	})
	.get('/stream', async () => {
		const stream = new ReadableStream<string>({
			async start(controller) {
				controller.enqueue('Hello, ');
				await sleep(1000);
				controller.enqueue('world!');
				await sleep(1000);
				controller.close();
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/plain',
			},
		});
	});

const v1 = router()
	// Basic inline route
	.get('/time', async () => Date.now())

	.merge('/stripe', exampleHandlingStripe)
	.merge('/response', exampleReturningResponse)

	// Basic object route
	.post('/time', {
		async run() {
			return {t: Date.now()};
		},
	})

	// How to throw an error
	.get('/throw', {
		run() {
			throw new KaitoError(400, 'Something was intentionally thrown');
		},
	})

	// Example parsing request body
	.post('/echo', {
		body: z.record(z.string(), z.unknown()),
		query: {
			name: z.string(),
		},
		async run({body, query}) {
			// Body is typed as `Record<string, unknown>`
			return {body, name: query.name};
		},
	})
	
	// example streaming SSE responses to get request using low level interface
	.get('/sse_stream', {
		query: {
			content: z.string()
		},
		run: async ({query}) => {
			// This is an example of using the SSESource interface
			return sse({
				async start(controller) {
					// ensure controller is closed
					using _ = controller;
					var i = 0;
					for await (const word of query.content.split(' ')) {
						i++
						controller.enqueue({
							id: i.toString(),
							data: word // only strings are supported in this SSE interface
						});
					}
				}
			});
		}
	})

	// example streaming SSE responses to post request with just an async generator
	.post('/sse_stream', {
		body: z.object({
			count: z.number()
		}),
		run: async ({body}) => {
			// This is an example of a discriminated union being sent on the stream
			return sse(async function*() {
				for (let i = 0; i < Math.max(body.count,100); i++) {
					yield randomEvent(); // random event is a discriminated union on "data"
					await sleep(100);
				}
			});
		}
	})

	// example streaming SSE responses to post request with just an async generator
	.post('/sse_stream_union', {
		body: z.object({
			count: z.number()
		}),
		run: async ({body}) => {
			// This is an example of a union of different types being sent on the stream
			return sse(async function*() {
				for (let i = 0; i < Math.max(body.count,100); i++) {
					yield {
						data: randomEvent().data // this is just a union, not discriminated
					};
					await sleep(100);
				}
			});
		}
	})

	// Merge this router with another router (users).
	.merge('/users', users);

const exampleOfThrough = router()
	.through(async old => ({
		...old,
		lol: new Date(),
	}))
	.get('/test', async ({ctx}) => ctx.lol.getTime());

const root = router()
	// Basic inline access context
	.get('/', async ({ctx}) => ctx.ip)
	.get('/uptime', async ({ctx}) => ctx.uptime)
	.post('/uptime', async ({ctx}) => ctx.uptime)

	.merge('/through', exampleOfThrough)

	// Accessing query
	.get('/query', {
		query: {
			age: z
				.string()
				.transform(value => parseInt(value, 10))
				.default('10'),
		},

		run: async ({query}) => query.age,
	})

	// Merge this router with another router (v1)
	.merge('/v1', v1);

const cors = (origin: string, response: Response) => {
	response.headers.set('Access-Control-Allow-Origin', origin);
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	response.headers.set('Access-Control-Max-Age', '86400');
	response.headers.set('Access-Control-Allow-Credentials', 'true');
	return response;
};

const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://app.example.com'];

const handle = createKaitoHandler({
	router: root,
	getContext,

	onError: async ({error}) => ({
		status: 500,
		message: error.message,
	}),

	before: async req => {
		const origin = req.headers.get('origin');

		if (req.method === 'OPTIONS' && origin && ALLOWED_ORIGINS.includes(origin)) {
			return cors(origin, new Response(null, {status: 204}));
		}
	},

	transform: async (req, res) => {
		const origin = req.headers.get('origin');

		if (origin && ALLOWED_ORIGINS.includes(origin)) {
			return cors(origin, res);
		}
	},
});

const server = await KaitoServer.serve({
	port: 3000,
	fetch: handle,
});

console.log('Server listening at', server.url);

export type App = typeof root;
