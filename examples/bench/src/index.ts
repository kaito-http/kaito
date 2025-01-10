import {createKaitoHandler} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {KaitoServer} from '@kaito-http/uws';
import {getContext, router} from './context.ts';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const root = router().get('/stream', async () => {
	const text = "This is an example of text being streamed every 100ms by using Kaito's sse() function";

	return sse(async function*() {
		for (const word in text.split(' ')) {
			yield {
				data: word
			}
			await sleep(100);
		}
	});
});

const fetch = createKaitoHandler({
	router: root,
	getContext,

	onError: async ({error}) => ({
		status: 500,
		message: error.message,
	}),
});

const server = await KaitoServer.serve({
	fetch,
	port: 3000,
	host: '127.0.0.1',
});

console.log('Server listening at', server.url);

export type App = typeof root;
