import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {createKaitoHTTPClient, KaitoClientHTTPError, KaitoSSEStream} from './index.ts';

import type {App} from './router.test.ts';

describe('KaitoHTTPClient', () => {
	describe('Basic HTTP operations', () => {
		test('should make GET requests', async () => {
			const mockFetch = async (req: Request) => {
				assert.equal(req.method, 'GET');
				assert.equal(req.url, 'http://api.example.com/users?limit=10');
				return new Response(
					JSON.stringify({
						success: true,
						data: [{id: 1, name: 'Test User'}],
					}),
				);
			};

			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				fetch: mockFetch,
			});

			const result = await client.get('/users', {
				query: {limit: '10'},
			});

			assert.deepEqual(result, [{id: 1, name: 'Test User'}]);
		});

		test('should make POST requests with body', async () => {
			const mockFetch = async (req: Request) => {
				assert.equal(req.method, 'POST');
				assert.equal(req.url, 'http://api.example.com/users');
				const body = await req.json();
				assert.deepEqual(body, {name: 'New User'});
				return new Response(
					JSON.stringify({
						success: true,
						data: {id: 1, name: 'New User'},
					}),
				);
			};

			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				fetch: mockFetch,
			});

			const result = await client.post('/users', {
				body: {name: 'New User'},
			});

			assert.deepEqual(result, {id: 1, name: 'New User'});
		});

		test('should handle URL parameters', async () => {
			const mockFetch = async (req: Request) => {
				assert.equal(req.method, 'GET');
				assert.equal(req.url, 'http://api.example.com/users/123');

				return new Response(
					JSON.stringify({
						success: true,
						data: {id: 123, name: 'Test User'},
					}),
				);
			};

			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				fetch: mockFetch,
			});

			const result = await client.get('/users/:id', {
				params: {id: '123'},
			});

			assert.deepEqual(result, {id: 123, name: 'Test User'});
		});

		test('should handle query parameters', async () => {
			const mockFetch = async (req: Request) => {
				assert.equal(req.method, 'GET');
				const url = new URL(req.url);
				assert.equal(url.searchParams.get('limit'), '10');
				return new Response(
					JSON.stringify({
						success: true,
						data: [{id: 1, name: 'Test User'}],
					}),
				);
			};

			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				fetch: mockFetch,
			});

			const result = await client.get('/users', {
				query: {limit: '10'},
			});

			assert.deepEqual(result, [{id: 1, name: 'Test User'}]);
		});
	});

	describe('Error handling', () => {
		test('should throw KaitoClientHTTPError for error responses', async () => {
			const mockFetch = async () => {
				return Response.json(
					{
						success: false,
						message: 'Not Found',
						data: null,
					},
					{status: 404},
				);
			};

			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				fetch: mockFetch,
			});

			await assert.rejects(
				async () => {
					await client.get('/users/:id', {
						params: {id: '999'},
					});
				},
				(error: unknown) => {
					assert(error instanceof KaitoClientHTTPError);
					assert.equal(error.response.status, 404);
					assert.deepEqual(error.body, {
						success: false,
						message: 'Not Found',
						data: null,
					});
					return true;
				},
			);
		});

		test('should handle non-JSON error responses', async () => {
			const mockFetch = async () => {
				return new Response('Internal Server Error', {
					status: 500,
					headers: {'Content-Type': 'text/plain'},
				});
			};

			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				fetch: mockFetch,
			});

			await assert.rejects(
				async () => {
					await client.get('/users', {
						query: {limit: '10'},
					});
				},
				(error: unknown) => {
					assert(error instanceof KaitoClientHTTPError);
					assert(error.body.message.includes('Request to'));
					assert.equal(error.response.status, 500);
					return true;
				},
			);
		});
	});

	describe('SSE Streaming', () => {
		test('should handle SSE streams', async () => {
			const mockEvents = [
				{event: 'message', data: 'Hello'},
				{event: 'message', data: 'World'},
			];

			const mockFetch = async () => {
				const encoder = new TextEncoder();
				const stream = new ReadableStream({
					start(controller) {
						mockEvents.forEach(event => {
							const eventString = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
							controller.enqueue(encoder.encode(eventString));
						});
						controller.close();
					},
				});

				return new Response(stream, {
					headers: {'Content-Type': 'text/event-stream'},
				});
			};

			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				fetch: mockFetch,
			});

			const stream = await client.get('/stream', {
				sse: true,
			});

			assert(stream instanceof KaitoSSEStream);

			const events = [];
			for await (const event of stream) {
				events.push(event);
			}

			assert.equal(events.length, 2);
			assert.deepEqual(events[0], {event: 'message', data: 'Hello'});
			assert.deepEqual(events[1], {event: 'message', data: 'World'});
		});
	});

	describe('Request modifications', () => {
		test('should allow request modification via before hook', async () => {
			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				before: async (url, init) => {
					const request = new Request(url, init);
					request.headers.set('Authorization', 'Bearer test-token');
					return request;
				},
				fetch: async req => {
					assert.equal(req.headers.get('Authorization'), 'Bearer test-token');
					return new Response(
						JSON.stringify({
							success: true,
							data: [{id: 1, name: 'Test User'}],
						}),
					);
				},
			});

			const result = await client.get('/users', {
				query: {limit: '10'},
			});

			assert.deepEqual(result, [{id: 1, name: 'Test User'}]);
		});

		test('should handle AbortController signals', async () => {
			const controller = new AbortController();
			const client = createKaitoHTTPClient<App>({
				base: 'http://api.example.com',
				fetch: () =>
					new Promise((_, reject) => {
						controller.signal.addEventListener('abort', () => {
							reject(new DOMException('The operation was aborted.', 'AbortError'));
						});
						setTimeout(() => controller.abort(), 0);
					}),
			});

			await assert.rejects(
				() =>
					client.get('/users', {
						signal: controller.signal,
						query: {limit: '10'},
					}),
				{name: 'AbortError'},
			);
		});
	});
});
