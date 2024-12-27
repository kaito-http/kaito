import {createKaitoHandler, KaitoError} from '@kaito-http/core';
import {KaitoServer} from '@kaito-http/llhttp-wasm';
import stripe from 'stripe';
import {z} from 'zod';
import {getContext, router} from './context.ts';

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

const webCrypto = stripe.createSubtleCryptoProvider();
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

const exampleReturningResponse = router().get('/', async () => {
	return new Response('Hello world', {
		status: 200,
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

const CORS_HEADERS_ITERABLE = [
	['Access-Control-Allow-Origin', 'http://localhost:3000'],
	['Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'],
	['Access-Control-Allow-Headers', 'Content-Type, Authorization'],
	['Access-Control-Max-Age', '86400'],
	['Access-Control-Allow-Credentials', 'true'],
] satisfies Iterable<[string, string]>;

const CORS_HEADERS = new Headers(CORS_HEADERS_ITERABLE);

const handler = createKaitoHandler({
	router: root,
	getContext,

	// Before runs code before every request. This is helpful for setting things like CORS.
	// You can return a value from before, and it will be passed to the after call.
	// If you return a response in `before`, the router will not be called.
	before: async req => {
		if (req.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: CORS_HEADERS,
			});
		}

		// Return something from `before`, and it will be passed to `after`.
		return {
			timestamp: Date.now(),
		};
	},

	// Access the return value from `before` in `after`.
	// This does NOT get called if `before` returns a response.
	after: async ({timestamp}, res) => {
		for (const [key, value] of CORS_HEADERS_ITERABLE) {
			res.headers.set(key, value);
		}

		console.log(`Request took ${Date.now() - timestamp}ms`);
	},

	async onError({error}) {
		return {
			status: 500,
			message: error.message,
		};
	},
});

const server = new KaitoServer({
	fetch: handler,
});

await server.listen(3000, '0.0.0.0');

console.log('Server listening at', server.url);

export type App = typeof root;
