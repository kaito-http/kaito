import assert from 'node:assert';
import {describe, it} from 'node:test';
import {z} from 'zod';
import {KaitoError} from '../error.ts';
import {Router} from './router.ts';

type Context = {
	userId: string;
};

type AuthContext = Context & {
	isAdmin: boolean;
};

describe('Router', () => {
	describe('create', () => {
		it('should create an empty router', () => {
			const router = Router.create<Context>();
			assert.strictEqual(router.routes.size, 0);
		});
	});

	describe('route handling', () => {
		it('should handle GET requests', async () => {
			const router = Router.create<Context>().get('/users', {
				run: async () => ({users: []}),
			});

			const handler = router.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(new Request('http://localhost/users', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {users: []},
				message: 'OK',
			});
		});

		it('should handle POST requests with body parsing', async () => {
			const router = Router.create<Context>().post('/users', {
				body: z.object({name: z.string()}),
				run: async ({body}) => ({id: '1', name: body.name}),
			});

			const handler = router.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(
				new Request('http://localhost/users', {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({name: 'John'}),
				}),
			);
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {id: '1', name: 'John'},
				message: 'OK',
			});
		});

		it('should handle URL parameters', async () => {
			const router = Router.create<Context>().get('/users/:id', {
				run: async ({params}) => ({id: params.id}),
			});

			const handler = router.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(new Request('http://localhost/users/456', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {id: '456'},
				message: 'OK',
			});
		});

		it('should handle query parameters', async () => {
			const router = Router.create<Context>().get('/search', {
				query: {
					q: z.string(),
					limit: z
						.string()
						.transform(value => Number(value))
						.pipe(z.number()),
				},
				run: async ({query}) => ({
					query: query.q,
					limit: query.limit,
				}),
			});

			const handler = router.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(new Request('http://localhost/search?q=test&limit=10', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {query: 'test', limit: 10},
				message: 'OK',
			});
		});
	});

	describe('middleware and context', () => {
		it('should transform context through middleware', async () => {
			const router = Router.create<Context>()
				.through(async ctx => ({
					...ctx,
					isAdmin: ctx.userId === 'admin',
				}))
				.get('/admin', {
					run: async ({ctx}) => ({
						isAdmin: (ctx as AuthContext).isAdmin,
					}),
				});

			const handler = router.freeze({
				getContext: async () => ({userId: 'admin'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(new Request('http://localhost/admin', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {isAdmin: true},
				message: 'OK',
			});
		});
	});

	describe('error handling', () => {
		it('should handle KaitoError with custom status', async () => {
			const router = Router.create<Context>().get('/error', {
				run: async () => {
					throw new KaitoError(403, 'Forbidden');
				},
			});

			const handler = router.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(new Request('http://localhost/error', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 403);
			assert.deepStrictEqual(data, {
				success: false,
				data: null,
				message: 'Forbidden',
			});
		});

		it('should handle generic errors with server error handler', async () => {
			const router = Router.create<Context>().get('/error', {
				run: async () => {
					throw new Error('Something went wrong');
				},
			});

			const handler = router.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Custom Error Message'}),
			});

			const response = await handler(new Request('http://localhost/error', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 500);
			assert.deepStrictEqual(data, {
				success: false,
				data: null,
				message: 'Custom Error Message',
			});
		});
	});

	describe('router merging', () => {
		it('should merge routers with prefix', async () => {
			const userRouter = Router.create<Context>().get('/me', {
				run: async ({ctx}) => ({id: ctx.userId}),
			});

			const mainRouter = Router.create<Context>().merge('/api', userRouter);

			const handler = mainRouter.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(new Request('http://localhost/api/me', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {id: '123'},
				message: 'OK',
			});
		});
	});

	describe('404 handling', () => {
		it('should return 404 for non-existent routes', async () => {
			const router = Router.create<Context>();
			const handler = router.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(new Request('http://localhost/not-found', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 404);
			assert.deepStrictEqual(data, {
				success: false,
				data: null,
				message: 'Cannot GET /not-found',
			});
		});

		it('should return 404 for wrong method on existing path', async () => {
			const router = Router.create<Context>().get('/users', {
				run: async () => ({users: []}),
			});

			const handler = router.freeze({
				getContext: async () => ({userId: '123'}),
				onError: async () => ({status: 500, message: 'Internal Server Error'}),
			});

			const response = await handler(new Request('http://localhost/users', {method: 'POST'}));
			const data = await response.json();

			assert.strictEqual(response.status, 404);
			assert.deepStrictEqual(data, {
				success: false,
				data: null,
				message: 'Cannot POST /users',
			});
		});
	});
});
