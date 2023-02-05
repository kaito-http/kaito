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
			403: z.string(),
		},
	},

	({body, reply}) => {
		if (Math.random() > 0.8) {
			return reply(403, 'ok');
		}

		return reply(200, body.name);
	}
);

const app = server({
	router: index,
	getContext,
});

void app.listen(8080);
