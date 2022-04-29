import {Before, createServer, KaitoError} from '@kaito-http/core';
import {z} from 'zod';
import {createRouter, getContext} from './context';

const router = createRouter()
	.add({
		path: '/uptime',
		method: 'GET',
		async run({ctx}) {
			return ctx.uptime;
		},
	})
	.merge(
		'/v1',
		createRouter()
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
				input: z.unknown(),
				async run({input}) {
					return input;
				},
			})
			.merge(
				'/users',
				createRouter().add({
					path: '/:id',
					method: 'GET',
					input: z.null(),
					async run({params}) {
						return {
							user_id: params.id,
							prop: true,
						};
					},
				})
			)
	);

const cors: Before = async (req, res) => {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.setHeader('Access-Control-Max-Age', '86400');
	res.setHeader('Access-Control-Allow-Credentials', 'true');

	if (req.method === 'OPTIONS') {
		res.statusCode = 204;
		res.end();
	}
};

const server = createServer({
	router,
	getContext,
	before: [cors],
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
