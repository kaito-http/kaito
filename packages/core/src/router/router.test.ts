import assert from 'node:assert';
import {describe, it} from 'node:test';
import {z} from 'zod';
import {KaitoError} from '../error.ts';
import type {AnyRoute} from '../route.ts';
import {Router} from './router.ts';
import type {KaitoMethod} from './types.ts';

class TestRouter<ContextFrom, ContextTo, R extends AnyRoute> extends Router<ContextFrom, ContextTo, R> {
	public static override getFindRoute = Router.getFindRoute;
}

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

			const handler = router.serve({
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

			const handler = router.serve({
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

			const handler = router.serve({
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

			const handler = router.serve({
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

			const handler = router.serve({
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

			const handler = router.serve({
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

			const handler = router.serve({
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

			const handler = mainRouter.serve({
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
			const handler = router.serve({
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

			const handler = router.serve({
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

	describe('findRoute', () => {
		const dummyHandler = async () => {};

		const routes = new Map<string, Map<KaitoMethod, () => Promise<void>>>([
			[
				'/users/:id',
				new Map([
					['GET', dummyHandler],
					['PUT', dummyHandler],
				]),
			],
			[
				'/posts/:postId/comments/:commentId',
				new Map([
					['GET', dummyHandler],
					['DELETE', dummyHandler],
				]),
			],
			['/health', new Map([['GET', dummyHandler]])],
			['/', new Map([['GET', dummyHandler]])],
			['/users/:id/posts/:slug', new Map([['GET', dummyHandler]])],
		]);

		const findRoute = TestRouter.getFindRoute(routes);

		it('should match exact routes', () => {
			const result = findRoute('GET', '/health');
			assert.deepStrictEqual(result, {
				route: dummyHandler,
				params: {},
			});
		});

		it('should match routes with single parameter', () => {
			const result = findRoute('GET', '/users/123');
			assert.deepStrictEqual(result, {
				route: dummyHandler,
				params: {
					id: '123',
				},
			});
		});

		it('should match routes with multiple parameters', () => {
			const result = findRoute('DELETE', '/posts/456/comments/789');
			assert.deepStrictEqual(result, {
				route: dummyHandler,
				params: {
					postId: '456',
					commentId: '789',
				},
			});
		});

		it('should return empty object for non-existent paths', () => {
			const result = findRoute('GET', '/nonexistent');
			assert.deepStrictEqual(result, {});
		});

		it('should return empty object for non-existent methods on valid paths', () => {
			const result = findRoute('DELETE', '/users/123');
			assert.deepStrictEqual(result, {});
		});

		it('should handle root path correctly', () => {
			const result = findRoute('GET', '/');
			assert.deepStrictEqual(result, {
				route: dummyHandler,
				params: {},
			});
		});

		it('should handle paths with trailing slashes', () => {
			const result = findRoute('GET', '/users/123/');
			assert.deepStrictEqual(result, {
				route: dummyHandler,
				params: {
					id: '123',
				},
			});
		});

		it('should handle paths with multiple consecutive slashes', () => {
			const result = findRoute('GET', '/users///123');
			assert.deepStrictEqual(result, {
				route: dummyHandler,
				params: {
					id: '123',
				},
			});
		});

		it('should not match partial paths', () => {
			const result = findRoute('GET', '/users/123/extra');
			assert.deepStrictEqual(result, {});
		});

		it('should match numeric and special character parameters', () => {
			const result = findRoute('GET', '/users/123/posts/hello-world@2');
			assert.deepStrictEqual(result, {
				route: dummyHandler,
				params: {
					id: '123',
					slug: 'hello-world@2',
				},
			});
		});

		it('should be case sensitive for non-parameter parts', () => {
			const result = findRoute('GET', '/USERS/123');
			assert.deepStrictEqual(result, {});
		});

		it('should handle empty parameter values', () => {
			const result = findRoute('GET', '/users//');
			assert.deepStrictEqual(result, {});
		});
	});
});
