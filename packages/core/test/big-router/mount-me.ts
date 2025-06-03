import {k} from '@kaito-http/core';
import {router} from './router.ts';

const schema = k.object({hello: k.string()});

export const mountMe = router
	.post('/post', {
		query: {
			name: schema,
		},
		body: schema,
		run: async ({ctx, body, query}) => {
			return body.hello + ctx.foo + query.name.hello;
		},
	})
	.put('/put', {
		body: schema,
		run: async ({ctx}) => {
			return ctx.foo;
		},
	})
	.patch('/patch', {
		body: schema,
		run: async ({ctx}) => {
			return ctx.foo;
		},
	})
	.delete('/delete', {
		body: schema,
		run: async ({ctx}) => {
			return ctx.foo;
		},
	})
	.get('/get', {
		run: async ({ctx}) => {
			return ctx.foo;
		},
	});
