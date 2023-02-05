import {router} from '@kaito-http/core';

const getContext = (req, res) => {
	return {
		getUser: async () => {
			const session = await redis.get('token:' + req.headers.authorization);

			const user = await db.getUserFromSession(session);

			if (!user) {
				throw new Error('you are not logged in');
			}

			return user;
		},
	};
};

// switch, middleware, inject, context
const teams = router()
	.switch(async ctx => {
		const user = await ctx.getUser();

		if (!user) {
			throw new Error('you are not logged in');
		}

		return {...ctx, user};
	})

	.post(
		'/',
		{
			description: 'Creates a new team',
			tags: ['teams', 'create'],
			body: z.object({
				name: z.string(),
			}),
			response: z.string(),
			query: {
				project: z.string(),
			},
		},
		async ({body, ctx}) => {
			// TODO: Create team
		}
	);

const v1 = router().merge('/teams', teams);

const app = router().merge('/v1', v1).merge('/v2', v2);
