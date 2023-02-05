import {kaito, createContext} from '@kaito-http/core';
import {z} from 'zod';

const {getContext, router} = createContext(async () => {
	return {
		foo: 'bar',
	};
});

const app = router().get(
	'/users/:discord_id/kv/:key',
	{
		// body: z.object({
		// 	name: z.string(),
		// }),
		response: {
			200: z.string(),
			401: z.literal('You are not authorized'),
		},
	},
	d => {
		d.body;

		if (Math.random() > 0.8) {
			return null;
		}

		return null;
	}
);

const server = kaito(app, {
	getContext,
});

void server.listen(8080);
