import {createServer, KaitoError} from '@kaito-http/core';
import {z} from 'zod';
import {createRouter, getContext} from './context';

const users = createRouter().add({
	method: 'POST',
	path: '/:id',
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
	.add({
		path: '/time',
		method: 'GET',
		async run() {
			return Date.now();
		},
	})
	.add({
		path: '/time',
		method: 'POST',
		async run() {
			return {t: Date.now()};
		},
	})
	.add({
		path: '/throw',
		method: 'GET',
		async run() {
			throw new KaitoError(400, 'Something was intentionally thrown');
		},
	})
	.add({
		method: 'GET',
		path: '/echo',
		body: z.string(),
		async run({body}) {
			return body;
		},
	})
	.merge('/users', users);

const router = createRouter()
	.add({
		path: '/uptime',
		method: 'GET',
		async run({ctx}) {
			return ctx.uptime;
		},
	})
	.add({
		path: '/uptime',
		method: 'POST',
		async run({ctx}) {
			return ctx.uptime;
		},
	})
	.merge('/v1', v1);

const server = createServer({
	router,
	getContext,

	rawRoutes: {
		GET: [
			{
				path: '/',
				handler(request, response) {
					response.end('welcome to kaito');
				},
			},
		],
	},

	async before(req, res) {
		res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.setHeader('Access-Control-Max-Age', '86400');
		res.setHeader('Access-Control-Allow-Credentials', 'true');

		if (req.method === 'OPTIONS') {
			res.statusCode = 204;
			res.end();
		}
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
