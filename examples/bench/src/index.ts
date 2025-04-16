// @ts-nocheck

import {create} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {KaitoServer} from '@kaito-http/uws';
import {setTimeout as sleep} from 'node:timers/promises';

const router = create();

const sub = router.params().get('/', ({params}) => {
	console.log(params);

	return params;
});

router().get('/', ({params}) => params.user_id);

const userRouter = router<'user_id'>(r =>
	r
		.get('/', ({params}) => params.user_id)
		.post('/', ({params}) => params.user_id)
		.delete('/', ({params}) => params.user_id)
		.patch('/', ({params}) => params.user_id)
		.head('/', ({params}) => params.user_id),
);

router.merge('/users/:user_id', userRouter);

const app = router
	.get('/hello', () => 'hi' as const)
	.get('/stream', () => {
		const text = "This is an example of text being streamed every 100ms by using Kaito's sse() function";

		return sse(async function* () {
			for (const word in text.split(' ')) {
				yield {data: word, event: 'cool', retry: 1000};

				await sleep(100);
			}
		});
	})
	.merge('/:age', sub);

const server = await KaitoServer.serve({
	fetch: app.serve(),
	port: 3000,
	host: '127.0.0.1',
});

console.log('Server listening at', server.url);

export type App = typeof app;
