import {init} from '@kaito-http/core';
import {z} from 'zod';

export const {getContext, router} = init({
	openapi: {
		tags: [
			{
				name: 'users',
				description: 'User management',
			},
			'kv',
		],
	},
});

router().get(
	'/',
	{
		tags: ['users'],
		response: {
			200: z.number(),
		},
	},
	async ({reply}) => {
		return reply(200, 20);
	}
);
