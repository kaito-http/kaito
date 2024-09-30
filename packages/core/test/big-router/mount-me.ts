import {type Parsable} from 'core/src/util.ts';
import {router} from './router.ts';

declare const schema: Parsable<{hello: string}>;

export const mountMe = router()
	.post('/post', {
		query: {
			name: schema,
		},
		body: schema,
		run: async ({ctx, body}) => {
			return body.hello + ctx.foo;
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
