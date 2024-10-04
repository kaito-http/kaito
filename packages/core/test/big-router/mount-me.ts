import {type Parsable} from '../../src/util.ts';
import {router} from './router.ts';

declare const schema: Parsable<{hello: string}, string>;

export const mountMe = router()
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
