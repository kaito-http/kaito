import {createServer, KaitoError} from '@kaito-http/core';
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

const server = createServer({
	router,
	getContext,
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
