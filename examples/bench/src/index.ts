import {createKaitoHandler} from '@kaito-http/core';
import {KaitoServer} from '@kaito-http/uws';
import {getContext, router} from './context.ts';

const root = router()
	.get('/', async () => 'Hey!')
	.get('/stream', async () => {
		const text = 'This is an example of text being streamed every 200ms by using Response directly';

		const stream = new ReadableStream({
			async start(controller) {
				for await (const chunk of text) {
					controller.enqueue(chunk);
					await new Promise(resolve => setTimeout(resolve, 200));
				}
				controller.close();
			},
		});

		return new Response(stream);
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
});

console.log('Server listening at', server.url);
