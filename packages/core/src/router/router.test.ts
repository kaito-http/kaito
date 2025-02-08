import assert from 'node:assert';
import {describe, it} from 'node:test';
import {z} from 'zod';
import {create} from '../create.ts';
import {KaitoError} from '../error.ts';
import type {AnyRoute} from '../route.ts';
import {Router} from './router.ts';
import type {KaitoMethod} from './types.ts';

const router = create({
	getContext: req => ({req}),
	onError: () => ({status: 500, message: 'Internal Server Error'}),
});

describe('Router', () => {
	describe('create', () => {
		it('should create an empty router', () => {
			const r = router();
			assert.strictEqual(r.routes.size, 0);
		});
	});

	describe('route handling', () => {
		it('should handle GET requests', async () => {
			const r = router().get('/users', {
				run: async () => ({users: []}),
			});

			const handler = r.serve();

			const response = await handler(new Request('http://localhost/users', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {users: []},
			});
		});

		it('should handle POST requests with body parsing', async () => {
			const r = router().post('/users', {
				body: z.object({name: z.string()}),
				run: async ({body}) => ({id: '1', name: body.name}),
			});

			const handler = r.serve();

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
			});
		});

		it('should handle URL parameters', async () => {
			const r = router().get('/users/:id', {
				run: async ({params}) => ({id: params.id}),
			});

			const handler = r.serve();

			const response = await handler(new Request('http://localhost/users/456', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {id: '456'},
			});
		});

		it('should handle query parameters', async () => {
			const r = router().get('/search', {
				query: {
					q: z.string(),
					limit: z.coerce.number(),
				},
				run: async ({query}) => ({
					query: query.q,
					limit: query.limit,
				}),
			});

			const handler = r.serve();

			const response = await handler(new Request('http://localhost/search?q=test&limit=10', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {query: 'test', limit: 10},
			});
		});
	});

	describe('.through() and context', () => {
		it('should transform context with .through()', async () => {
			const r = router()
				.through(ctx => ({
					...ctx,
					isAdmin: ctx.req.headers.get('Authorization') === 'Bearer admin-token',
				}))
				.get('/admin', ({ctx}) => ({isAdmin: ctx.isAdmin}));

			const handler = r.serve();

			const response = await handler(
				new Request('http://localhost/admin', {
					method: 'GET',
					headers: {Authorization: 'Bearer admin-token'},
				}),
			);

			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {isAdmin: true},
			});
		});
	});

	describe('error handling', () => {
		it('should handle KaitoError with custom status', async () => {
			const r = router().get('/error', {
				run: async () => {
					throw new KaitoError(403, 'Forbidden');
				},
			});

			const handler = r.serve();

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
			const r = create({
				onError: () => ({status: 500, message: 'Custom Error Message'}),
			})().get('/error', {
				run: async () => {
					throw new Error('Something went wrong');
				},
			});

			const handler = r.serve();

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
			const userRouter = router().get('/:user_id', {
				run: ({params}) => ({id: params.user_id}),
			});

			const mainRouter = router().merge('/api', userRouter);

			const handler = mainRouter.serve();

			const response = await handler(new Request('http://localhost/api/1', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {id: '1'},
			});
		});
	});

	describe('404 handling', () => {
		it('should return 404 for non-existent routes', async () => {
			const r = router();

			const handler = r.serve();

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
			const r = router().get('/users', {
				run: async () => ({users: []}),
			});

			const handler = r.serve();

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
		const dummyHandler = () => {};

		const routes = new Map<KaitoMethod, Map<string, () => void>>([
			[
				'GET',
				new Map([
					['/users/:id', dummyHandler],
					['/health', dummyHandler],
					['/', dummyHandler],
					['/users/:id/posts/:slug', dummyHandler],
				]),
			],
			[
				'DELETE',
				new Map([
					['/users/:id/posts/:slug', dummyHandler],
					['/posts/:postId/comments/:commentId', dummyHandler],
				]),
			],
			['PUT', new Map([['/users/:id', dummyHandler]])],
		]);

		class ExposedInternalsRouter<ContextFrom, ContextTo, R extends AnyRoute> extends Router<ContextFrom, ContextTo, R> {
			public static override getFindRoute = Router.getFindRoute;
		}

		const findRoute = ExposedInternalsRouter.getFindRoute(routes);

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

	describe('Lifecycle hooks', () => {
		it('should short-circuit route execution when before hook returns a Response', async () => {
			const beforeRouter = create({
				before: () => Response.json({blocked: true}, {status: 403}),
			})().get('/should-not-run', {
				run: async () => ({should: 'not-run'}),
			});

			const handler = beforeRouter.serve();
			const response = await handler(new Request('http://localhost/should-not-run', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 403);
			assert.deepStrictEqual(data, {blocked: true});
		});

		it('should modify the route response using transform hook', async () => {
			const transformRouter = create({
				transform: async (_req, res) => {
					const originalData = await res.json();
					return Response.json({...originalData, transformed: true});
				},
			})().get('/transform-test', {
				run: async () => ({result: 'original'}),
			});

			const handler = transformRouter.serve();
			const response = await handler(new Request('http://localhost/transform-test', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 200);
			assert.deepStrictEqual(data, {
				success: true,
				data: {result: 'original'},
				transformed: true,
			});
		});

		it('should not apply transform hook to a before hook response', async () => {
			const beforeTransformRouter = create({
				before: () => Response.json({blocked: true}, {status: 403}),
				// Even though transform returns a new response, its return is ignored because the before hook short-circuits.
				transform: () => Response.json({shouldNot: 'modify'}, {status: 200}),
			})().get('/no-run', {
				run: async () => ({should: 'not-run'}),
			});

			const handler = beforeTransformRouter.serve();
			const response = await handler(new Request('http://localhost/no-run', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(response.status, 403);
			assert.deepStrictEqual(data, {blocked: true});
		});
	});

	describe('Custom Response handling', () => {
		it('should return the Response object as is if route handler returns a Response', async () => {
			const customResponseRouter = router().get('/custom', {
				run: async () => new Response('Custom Response', {status: 201}),
			});

			const handler = customResponseRouter.serve();
			const response = await handler(new Request('http://localhost/custom', {method: 'GET'}));
			const text = await response.text();

			assert.strictEqual(response.status, 201);
			assert.strictEqual(text, 'Custom Response');
		});
	});

	describe('Invalid JSON body handling', () => {
		it('should return 500 when invalid JSON is provided for a POST request', async () => {
			const invalidJsonRouter = router().post('/invalid', {
				body: z.object({name: z.string()}),
				run: async ({body}) => ({received: body.name}),
			});

			const handler = invalidJsonRouter.serve();
			const response = await handler(
				new Request('http://localhost/invalid', {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: 'this is not valid json',
				}),
			);

			const data = await response.json();

			assert.strictEqual(response.status, 500);
			assert.deepStrictEqual(data, {
				success: false,
				data: null,
				message: 'Internal Server Error',
			});
		});
	});

	describe('OpenAPI endpoint', () => {
		it('should serve the OpenAPI documentation at /openapi.json', async () => {
			const apiTitle = 'Test API';
			const apiVersion = '1.0.0';
			const openapiRouter = router().openapi({
				info: {
					title: apiTitle,
					version: apiVersion,
					description: 'This is a test API',
				},
				servers: {
					'http://localhost': 'Localhost development server',
				},
			});

			const handler = openapiRouter.serve();
			const response = await handler(new Request('http://localhost/openapi.json', {method: 'GET'}));
			const data = await response.json();

			assert.strictEqual(data.openapi, '3.0.0');
			assert.strictEqual(data.info.title, apiTitle);
			assert.strictEqual(data.info.version, apiVersion);
		});
	});
});
