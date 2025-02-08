import {create} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {KaitoServer} from '@kaito-http/uws';
import {setTimeout as sleep} from 'node:timers/promises';

const router = create();

const app = router()
	.get('/hello', () => 'hi' as const)
	.get('/stream', () => {
		const text = "This is an example of text being streamed every 100ms by using Kaito's sse() function";

		return sse(async function* () {
			for (const word in text.split(' ')) {
				yield {data: word, event: 'cool', retry: 1000};

				await sleep(100);
			}
		});
	});

const server = await KaitoServer.serve({
	fetch: app.serve(),
	port: 3000,
	host: '127.0.0.1',
});

console.log('Server listening at', server.url);

export type App = typeof app;
