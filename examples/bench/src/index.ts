import {create, k, KaitoHead, KaitoRequest, type Params} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {Server} from '@kaito-http/uws';
import {setTimeout as sleep} from 'node:timers/promises';

interface MyPluginOptions {
	log: string;
}

function myPlugin(options: MyPluginOptions) {
	console.log('My Plugin is setting up');

	return <C>(context: C, params: Params, request: KaitoRequest, head: KaitoHead) => {
		console.log('My Plugin ran on a request with params:', params, 'and request url:', request.url, 'and head:', head);

		return {
			...(context ?? {}),
			myPluginSetThis: options,
		};
	};
}

const router = create()
	.pipe(myPlugin({log: 'hi'}))
	.get('/', async ({ctx}) => {
		ctx.myPluginSetThis.log; // 'hi'
	});

const sub = router.params<'user_id'>().get('/', ({params}) => {
	return params.user_id;
});

const app = router
	.get('/hello/:test', {
		query: {
			limit: k.number(),
		},
		run: () => 'hi' as const,
	})
	.post('/stream', () => {
		const text = "This is an example of text being streamed every 100ms by using Kaito's sse() function";

		return sse(async function* () {
			for (const word in text.split(' ')) {
				yield {data: word, event: 'cool', retry: 1000};

				await sleep(100);
			}
		});
	})
	.merge('/:user_id', sub);

const server = await Server.serve({
	fetch: app.serve(),
	port: 3000,
	host: '127.0.0.1',
});

console.log('Server listening at', server.url);

export type App = typeof app;
