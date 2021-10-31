import {createRouter, getContext} from './context';
import {z} from 'zod';
import {createServer} from '@kaito-http/core';

const router = createRouter().get('/', {
	input: z.object({
		username: z.string(),
	}),
	async run({ctx, input}) {
		return {
			time: ctx.time.getSeconds(),
			username: input.username,
		};
	},
});

const server = createServer({
	router,
	getContext,
});

void server.listen(3000).then(console.log);
