import {createServer} from '@kaito-http/core';
import {createRouter, getContext} from './context';

const router = createRouter().get('/', {
	async run({ctx}) {
		return {
			uptime: ctx.uptime,
			time_now: Date.now(),
		};
	},
});

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
