import {server, init} from '@kaito-http/core';
import {z} from 'zod';

const {getContext, router} = init();

const index = router().put('/users/:discord_id/kv/:key', {
	description: 'Sets a key-value pair for a user',
	tags: ['users', 'kv'],

	body: z.object({
		name: z.string(),
	}),

	response: {
		200: z.object({
			name: z.string(),
			kv: z.object({
				key: z.string(),
				value: z.string(),
			}),
		}),

		403: z.literal('You are not allowed to do this'),
	},

	handler: async ({body, params, reply}) => {
		if (Math.random() > 0.8) {
			return reply(403, 'You are not allowed to do this');
		}

		return reply(200, {
			name: body.name,
			kv: {
				key: params.key,
				value: params.discord_id,
			},
		});
	},
});

const app = server({
	router: index,
	getContext,
});

void app.listen(8080);
