import {createServer, KaitoError} from '@kaito-http/core';
import {z} from 'zod';
import {createRouter, getContext} from './context';

const users = createRouter().add('POST', '/:id', {
	body: z.object({
		name: z.string(),
	}),

	query: {
		limit: z
			.string()
			.transform(value => parseInt(value, 10))
			.default('10'),
	},

	async run({ctx, body, params, query}) {
		return {
			uptime: ctx.uptime,
			body,
			params,
			query,
		};
	},
});

const v1 = createRouter()
	// Basic inline route
	.add('GET', '/time', async () => Date.now())

	// Basic object route
	.add('POST', '/time', {
		async run() {
			return {t: Date.now()};
		},
	})

	// How to throw an error
	.add('GET', '/throw', {
		run() {
			throw new KaitoError(400, 'Something was intentionally thrown');
		},
	})

	// Example parsing request body
	.add('POST', '/echo', {
		body: z.record(z.string(), z.unknown()),

		async run({body}) {
			// Body is typed as `Record<string, unknown>`
			return body;
		},
	})

	// Merge this router with another router (users).
	.merge('/users', users);

const router = createRouter()
	// Basic inline access context
	.add('GET', '/uptime', async ({ctx}) => ctx.uptime)
	.add('POST', '/uptime', async ({ctx}) => ctx.uptime)

	// Accessing query
	.add('GET', '/query', {
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

const server = createServer({
	router,
	getContext,

	// Example of handling routes outside of Kaito.
	// Raw routes are not typed, and you have to handle errors yourself.
	// They are really a last resort! The use case is, for example, handling
	// stripe webhooks, OAuth, etc. Things like that.
	rawRoutes: {
		GET: [
			{
				path: '/',
				handler(request, response) {
					// You can access body by using something like `raw-body` on NPM.
					// This is not included in Kaito's raw routes because raw routes
					// are just a wrapper around Node's `http` module.

					response.end('welcome to kaito\'s raw routes');
				},
			},
		],
	},

	// Before runs code before every request. This is helpful for setting things like CORS.
	// You can return a value from before, and it will be passed to the after call.
	// If you end the response in `before`, the router will not be called.
	async before(req, res) {
		res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.setHeader('Access-Control-Max-Age', '86400');
		res.setHeader('Access-Control-Allow-Credentials', 'true');

		if (req.method === 'OPTIONS') {
			res.statusCode = 204;
			// This is safe, because the router will know that the response is ended.
			res.end();
		}

		// Return something from `before`, and it will be passed to `after`.
		return {
			timestamp: Date.now(),
		};
	},

	// Access the return value from `before` in `after`.
	// If the before function ends the response, this *will* be called!
	// So be careful about logging request durations etc
	async after({timestamp}) {
		console.log(`Request took ${Date.now() - timestamp}ms`);
	},

	async onError({error}) {
		console.log(error);

		return {
			status: 500,
			message: error.message,
		};
	},
});

server.listen(8080);

export type App = typeof router;
