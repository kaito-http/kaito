import {createServer} from '@kaito-http/core';
import {createRouter, getContext} from './context';

const router = createRouter().get('/:id', {
	async run({params}) {
		return params;
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
