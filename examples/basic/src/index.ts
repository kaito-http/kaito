import {Before, createServer, KaitoError} from '@kaito-http/core';
import {z} from 'zod';
import {createRouter, getContext} from './context';

const router = createRouter()
	.get('/uptime', {
		async run({ctx}) {
			return ctx.uptime;
		},
	})
	.merge(
		'/v1',
		createRouter()
			.get('/time', {
				async run() {
					return Date.now();
				},
			})
			.post('/time', {
				async run() {
					return {t: Date.now()};
				},
			})
			.get('/throw', {
				async run() {
					throw new KaitoError(400, 'Something was intentionally thrown');
				},
			})
			.get('/echo', {
				input: z.unknown(),
				async run({input}) {
					return input;
				},
			})
			.merge(
				'/users',
				createRouter().get('/:id', {
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
