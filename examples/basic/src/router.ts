import {init} from '@kaito-http/core';
import {z} from 'zod';

export const {getContext, router} = init({
	openapi: {
		tags: ['users', 'kv'],
	},
});

router().get(
	'/',
	{
		response: {
			200: z.number(),
		},
	},
	async ({reply}) => {
		return reply(200, 20);
	}
);
