import {server, init} from '@kaito-http/core';
import {z} from 'zod';

const {getContext, router} = init();

const index = router().post(
	'/users/:discord_id/kv/:key',
	{
		body: z.object({
			name: z.string(),
		}),
		response: {
			200: z.string(),
			401: z.literal('You are not authorized'),
		},
	},
	d => {
		if (Math.random() > 0.8) {
			return null;
		}

		return null;
	}
);

const app = server({
	router: index,
	getContext,
});

void app.listen(8080);
