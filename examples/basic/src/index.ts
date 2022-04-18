import {createServer} from '@kaito-http/core';
import {z} from 'zod';
import {createRouter, getContext} from './context';

const router = createRouter()
	.get('/test', {
		async run({ctx}) {
			return {
				uptime: ctx.uptime,
				time_now: Date.now(),
			};
		},
	})
	.merge(
		'/v2',
		createRouter().get('/test', {
			input: z.string(),
			async run({ctx, input}) {
				return {
					uptime: ctx.uptime,
					input,
				};
			},
		})
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
