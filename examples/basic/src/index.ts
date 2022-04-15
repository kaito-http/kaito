import {z} from 'zod';
import {createServer} from '@kaito-http/core';
import {createRouter, getContext} from './context';

const router = createRouter()
	.get('/', {
		input: z.object({username: z.string()}),
		async run({ctx, input}) {
			return {
				uptime: Math.floor(ctx.uptime / 1000),
				username: input.username,
			};
		},
	})
	.merge(
		'/prefix/',
		createRouter().get('test', {
			async run() {
				return 'bruh' as const;
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
