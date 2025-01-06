import {createKaitoHandler} from '@kaito-http/core';
import {KaitoServer} from '@kaito-http/uws';
import {getContext, router} from './context.ts';

const root = router().get('/', async () => 'Hey!');

const fetch = createKaitoHandler({
	router: root,
	getContext,

	onError: async ({error}) => ({
		status: 500,
		message: error.message,
	}),
});

await KaitoServer.serve({port: 3000, fetch});

console.log('Server listening at :3000');
