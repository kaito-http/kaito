import assert from 'node:assert/strict';
import {once} from 'node:events';
import {type AddressInfo, createServer} from 'node:net';
import {text} from 'node:stream/consumers';
import {describe, test} from 'node:test';
import {KaitoServer, type ServeUserOptions} from './index.ts';

async function getPort(): Promise<number> {
	const server = createServer();
	server.listen(0);
	await once(server, 'listening');
	const port = (server.address() as AddressInfo).port;
	server.close();
	return port;
}

async function createTestServer(options: Partial<ServeUserOptions> = {}) {
	const port = await getPort();
	const server = await KaitoServer.serve({
		port,
		fetch: options.fetch ?? (async () => new Response('ok')),
		...options,
	});
	return server;
}

describe('KaitoServer', () => {
	test('basic GET request', async () => {
		using server = await createTestServer({
			fetch: async req => {
				assert.equal(req.method, 'GET');
				return new Response('ok');
			},
		});

		const res = await fetch(server.url);
		assert.equal(await res.text(), 'ok');
	});

	test('request with query parameters', async () => {
		using server = await createTestServer({
			fetch: async req => {
				const url = new URL(req.url);
				assert.equal(url.searchParams.get('foo'), 'bar');
				assert.equal(url.searchParams.get('baz'), 'qux');
				return new Response('ok');
			},
		});

		const res = await fetch(`${server.url}/?foo=bar&baz=qux`);
		assert.equal(await res.text(), 'ok');
	});

	test('POST request with JSON body', async () => {
		const testData = {hello: 'world'};

		using server = await createTestServer({
			fetch: async req => {
				assert.equal(req.method, 'POST');
				assert.equal(req.headers.get('content-type'), 'application/json');
				const body = await req.json();
				assert.deepEqual(body, testData);
				return new Response('ok');
			},
		});

		const res = await fetch(server.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(testData),
		});
		assert.equal(await res.text(), 'ok');
	});

	test('POST request with large body', async () => {
		const largeData = Buffer.alloc(100_000_000, 'x').toString();

		using server = await createTestServer({
			fetch: async req => {
				assert.equal(req.method, 'POST');
				const body = await req.text();
				assert.equal(body, largeData);
				return new Response('ok');
			},
		});

		const res = await fetch(server.url, {
			method: 'POST',
			body: largeData,
		});

		assert.equal(await res.text(), 'ok');
	});

	test('POST request with streaming body', async () => {
		const chunks = ['chunk1', 'chunk2', 'chunk3'];
		const expectedBody = chunks.join('');
		const encoder = new TextEncoder();

		using server = await createTestServer({
			fetch: async req => {
				assert.equal(req.method, 'POST');
				assert(req.body instanceof ReadableStream);
				const [a, b] = req.body.tee();

				const body = text(a);

				let i = 0;
				for await (const chunk of b) {
					assert.equal(Buffer.from(chunk).toString('utf-8'), chunks[i] ?? '');
					i++;
				}

				assert.equal(await body, expectedBody);
				return new Response('ok');
			},
		});

		const stream = new ReadableStream({
			async start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(encoder.encode(chunk));
					await new Promise(resolve => setTimeout(resolve, 50));
				}
				controller.close();
			},
		});

		const res = await fetch(server.url, {
			method: 'POST',
			body: stream,
			// @ts-expect-error - duplex is not in @types/node
			duplex: 'half',
			headers: {
				'Content-Type': 'text/plain',
			},
		});

		assert.equal(await res.text(), 'ok');
	});

	test('custom headers', async () => {
		using server = await createTestServer({
			fetch: async req => {
				assert.equal(req.headers.get('x-custom-header'), 'test-value');
				return new Response('ok', {
					headers: {
						'x-response-header': 'response-value',
					},
				});
			},
		});

		const res = await fetch(server.url, {
			headers: {
				'x-custom-header': 'test-value',
			},
		});
		assert.equal(res.headers.get('x-response-header'), 'response-value');
	});

	test('streaming response', async () => {
		const chunks = ['Hello', ' ', 'World'];
		const encoder = new TextEncoder();

		using server = await createTestServer({
			fetch: async () => {
				const stream = new ReadableStream({
					async start(controller) {
						for (const chunk of chunks) {
							controller.enqueue(encoder.encode(chunk));
						}
						controller.close();
					},
				});

				return new Response(stream);
			},
		});

		const res = await fetch(server.url);
		const text = await res.text();
		assert.equal(text, chunks.join(''));
	});

	test('response status codes', async () => {
		using server = await createTestServer({
			fetch: async () => {
				return new Response('not found', {
					status: 404,
					statusText: 'Not Found',
				});
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 404);
		assert.equal(res.statusText, 'Not Found');
		assert.equal(await res.text(), 'not found');
	});

	test('multiple concurrent requests', async () => {
		let requestCount = 0;

		using server = await createTestServer({
			fetch: async () => {
				requestCount++;
				return new Response('ok');
			},
		});

		const requests = Array.from({length: 10}, () => fetch(server.url));
		await Promise.all(requests);
		assert.equal(requestCount, 10);
	});

	test('request with non-default host', async () => {
		const port = await getPort();
		using server = await KaitoServer.serve({
			port,
			host: '127.0.0.1',
			fetch: async req => {
				const url = new URL(req.url);
				assert.equal(url.hostname, '127.0.0.1');
				return new Response('ok');
			},
		});

		const res = await fetch(server.url);
		assert.equal(await res.text(), 'ok');
	});

	test('binary data handling', async () => {
		const binaryData = new Uint8Array([1, 2, 3, 4, 5]);

		using server = await createTestServer({
			fetch: async req => {
				const body = new Uint8Array(await req.arrayBuffer());
				assert.deepEqual(body, binaryData);
				return new Response(body);
			},
		});

		const res = await fetch(server.url, {
			method: 'POST',
			body: binaryData,
		});
		const responseData = new Uint8Array(await res.arrayBuffer());
		assert.deepEqual(responseData, binaryData);
	});

	test('request.signal property for abort handling', async () => {
		let signalWasValid = false;
		let requestAborted = false;

		using server = await createTestServer({
			fetch: async req => {
				assert.ok(req.signal instanceof AbortSignal, 'request.signal should be an AbortSignal');
				signalWasValid = true;

				req.signal.addEventListener('abort', () => {
					requestAborted = true;
				});

				assert.equal(req.signal.aborted, false, 'signal should not be aborted initially');

				return new Promise<Response>(resolve => {
					const timeout = setTimeout(() => {
						if (!req.signal.aborted) {
							resolve(new Response('completed'));
						}
					}, 100);

					req.signal.addEventListener('abort', () => {
						clearTimeout(timeout);
						resolve(new Response('aborted'));
					});
				});
			},
		});

		const responsePromise = fetch(server.url);
		await new Promise(resolve => setTimeout(resolve, 100));

		server.close();

		let didError = false;

		try {
			await responsePromise;
		} catch (error) {
			didError = true;
			assert.ok(error instanceof TypeError, 'request should be an error');
		}

		assert.equal(didError, true, 'request should have errored');
		assert.equal(requestAborted, true, 'request should have been aborted');
		assert.equal(signalWasValid, true, 'request.signal should have been a valid AbortSignal');
	});

	test('request signal abort state', async () => {
		let signalChecks: {aborted: boolean; reason?: any}[] = [];

		using server = await createTestServer({
			fetch: async req => {
				signalChecks.push({
					aborted: req.signal.aborted,
					reason: req.signal.reason,
				});

				await new Promise(resolve => setTimeout(resolve, 50));

				signalChecks.push({
					aborted: req.signal.aborted,
					reason: req.signal.reason,
				});

				return new Response('ok');
			},
		});

		const res = await fetch(server.url);
		assert.equal(await res.text(), 'ok');

		assert.equal(signalChecks.length, 2);
		assert.equal(signalChecks[0]!.aborted, false);
		assert.equal(signalChecks[1]!.aborted, false);
	});

	test('request context', async () => {
		let remoteAddress: string | undefined;

		using server = await createTestServer({
			fetch: async (_request, context) => {
				assert.equal(context.remoteAddress, '127.0.0.1');
				remoteAddress = context.remoteAddress;
				return new Response(context.remoteAddress);
			},
		});

		const res = await fetch(server.url);
		assert.equal(await res.text(), '127.0.0.1');
		assert.ok(typeof remoteAddress === 'string', 'remoteAddress should be a string');
	});

	test('server properties', async () => {
		const port = await getPort();
		const host = '127.0.0.1';

		using server = await KaitoServer.serve({
			port,
			host,
			fetch: async () => new Response('ok'),
		});

		assert.equal(server.address, `${host}:${port}`);
		assert.equal(server.url, `http://${host}:${port}`);
	});

	test('errors in fetch handler return 500 Internal Server Error', async () => {
		using server = await createTestServer({
			fetch: async () => {
				throw new Error('Something went wrong');
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 500);
		assert.equal(await res.text(), 'Internal Server Error');
	});

	test('async errors in fetch handler are caught and handled', async () => {
		using server = await createTestServer({
			fetch: async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				throw new Error('Async error occurred');
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 500);
		assert.equal(await res.text(), 'Internal Server Error');
	});

	test('synchronous errors in fetch handler are caught and handled', async () => {
		using server = await createTestServer({
			fetch: () => {
				throw new Error('Sync error occurred');
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 500);
		assert.equal(await res.text(), 'Internal Server Error');
	});

	test('custom onError handler receives error and can return custom response', async () => {
		let errorReceived: Error | undefined;
		let requestReceived: Request | undefined;

		using server = await createTestServer({
			fetch: async () => {
				throw new Error('Test error message');
			},
			onError: (error, request) => {
				errorReceived = error as Error;
				requestReceived = request;
				return new Response('Custom error response', {
					status: 418,
					statusText: "I'm a teapot",
				});
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 418);
		assert.equal(res.statusText, "I'm a teapot");
		assert.equal(await res.text(), 'Custom error response');
		assert.ok(errorReceived instanceof Error);
		assert.equal(errorReceived.message, 'Test error message');
		assert.ok(requestReceived instanceof Request);
	});

	test('async custom onError handler works correctly', async () => {
		using server = await createTestServer({
			fetch: async () => {
				throw new Error('Async fetch error');
			},
			onError: async error => {
				await new Promise(resolve => setTimeout(resolve, 10));
				return new Response(`Handled: ${(error as Error).message}`, {
					status: 503,
					statusText: 'Service Unavailable',
				});
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 503);
		assert.equal(res.statusText, 'Service Unavailable');
		assert.equal(await res.text(), 'Handled: Async fetch error');
	});

	test('errors thrown in onError handler fallback to default error handler', async () => {
		using server = await createTestServer({
			fetch: async () => {
				throw new Error('Original error');
			},
			onError: () => {
				throw new Error('Error in error handler');
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 500);
		assert.equal(await res.text(), 'Internal Server Error');
	});

	test('async errors thrown in onError handler fallback to default error handler', async () => {
		using server = await createTestServer({
			fetch: async () => {
				throw new Error('Original async error');
			},
			onError: async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				throw new Error('Async error in error handler');
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 500);
		assert.equal(await res.text(), 'Internal Server Error');
	});

	test('rejecting promises in onError handler fallback to default error handler', async () => {
		using server = await createTestServer({
			fetch: async () => {
				throw new Error('Original error');
			},
			onError: () => {
				return Promise.reject(new Error('Promise rejection in error handler'));
			},
		});

		const res = await fetch(server.url);
		assert.equal(res.status, 500);
		assert.equal(await res.text(), 'Internal Server Error');
	});

	test('error handling preserves request details when onError fails', async () => {
		using server = await createTestServer({
			fetch: async request => {
				assert.ok(request.url.includes(server.url));
				throw new Error('Test error with request details');
			},
			onError: (error, request) => {
				// Verify we receive both error and request in onError
				assert.ok(error instanceof Error);
				assert.ok(request instanceof Request);
				// But then fail in the error handler
				throw new Error('onError handler failed');
			},
		});

		const res = await fetch(`${server.url}/test-path?param=value`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({test: 'data'}),
		});

		assert.equal(res.status, 500);
		assert.equal(await res.text(), 'Internal Server Error');
	});

	// test('static routes', async () => {
	// 	const server = await createTestServer({
	// 		static: {
	// 			'/static/file.txt': new Response('Hello, world!'),
	// 			'/static/stream': new Response(
	// 				new ReadableStream({
	// 					async start(controller) {
	// 						controller.enqueue(new TextEncoder().encode('Hello, world!'));
	// 						controller.close();
	// 					},
	// 				}),
	// 			),
	// 		},
	// 	});

	// 	try {
	// 		const res = await fetch(server.url + '/static/file.txt');
	// 		assert.equal(await res.text(), 'Hello, world!');

	// 		const streamed = await fetch(server.url + '/static/file.txt');
	// 		assert.equal(await streamed.text(), 'Hello, world!');
	// 	} finally {
	// 		server.close();
	// 	}
	// });
});
