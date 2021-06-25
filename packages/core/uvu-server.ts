import * as z from 'zod';
import {Method, Server} from './src';

export const app = new Server();

app.route(
	Method.GET,
	'/',
	{
		query: z.object({
			test: z.number(),
		}),
	},
	async ctx => ({test: ctx.query.test})
);

app.route(
	Method.POST,
	'/users/:id/:hi',
	{
		query: z.object({
			limit: z.number(),
			skip: z.number(),
			since: z.string(),
		}),
		body: z.object({
			example: z.string(),
		}),
		params: z.object({
			id: z.string(),
			hi: z.string(),
		}),
	},
	async ctx => {
		const {example} = ctx.body;

		return {
			limit: ctx.query.limit,
			offset: ctx.query.skip,
			where: {
				example,
				user: ctx.params.id,
				since: {
					gt: ctx.query.since,
				},
			},
		};
	}
);
