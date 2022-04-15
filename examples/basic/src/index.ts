import {z} from 'zod';
import {createServer} from '@kaito-http/core';

import {createRouter, getContext} from './context';

const router = createRouter()
	.get('/', {
		input: z.object({username: z.string()}),
		async run({ctx, input}) {
			return {
				time: ctx.time.getSeconds(),
				username: input.username,
			};
		},
	})
	.merge(
		'/prefix/',
		createRouter().get('test', {
			async run() {
				return 'OK' as const;
			},
		})
	);

const server = createServer({
	router,
	getContext,
	async onError({error}) {
		return {
			code: 500,
			message: error.message,
		};
	},
});

void server.listen(8080).then(console.log);
