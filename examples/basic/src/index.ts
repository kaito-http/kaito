import {createServer, KaitoError} from '@kaito-http/core';
import {z} from 'zod';
import {createRouter, getContext} from './context';

const users = createRouter().get('/:id', {
	async run({params}) {
		return params;
	},
});

const v1 = createRouter()
	.get('/time', {
		async run() {
			return Date.now();
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
	.merge('/users', users);

const router = createRouter()
	.get('/uptime', {
		async run({ctx}) {
			return ctx.uptime;
		},
	})
	.merge('/v1', v1);

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
