// fake typing deno
declare const Deno: {serve: (options: {port: number}, handler: (req: Request) => Promise<Response>) => {}};

import {createKaitoHandler} from '@kaito-http/core';
import {getContext, router} from './context.ts';

const root = router().get('/', async () => 'hello from Deno.serve()');

const fetch = createKaitoHandler({
	router: root,
	getContext,

	onError: async ({error}) => ({
		status: 500,
		message: error.message,
	}),
});

Deno.serve({port: 3000}, fetch);

export type App = typeof root;
