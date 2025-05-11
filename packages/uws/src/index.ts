import uWS from 'uWebSockets.js';

export interface ServeOptions {
	port: number;
	host?: string;
	static?: Record<`/${string}`, Response>;
	fetch: (request: Request) => Promise<Response>;
}

export type ServeUserOptions = Omit<ServeOptions, 'host'> & Partial<Pick<ServeOptions, 'host'>>;

const SPACE = ' ';
const GET = 'get';
const HEAD = 'head';
const CONTENT_LENGTH = 'content-length';

function inflightRequestStore(res: uWS.HttpResponse) {
	return {
		get remoteAddress() {
			const value = Buffer.from(res.getRemoteAddressAsText()).toString('ascii');
			Object.defineProperty(this, 'remoteAddress', {value});
			return value;
		},
	};
}

export type RequestMetadata = ReturnType<typeof inflightRequestStore>;

const inflightRequestMetadataMap = new WeakMap<Request, RequestMetadata>();

// technically kaito's uws server could be used without using kaito core.
// so we should support the case where a user is trying to resolve a kaito request, or an actual request
export type RequestOrKaitoRequest = Request | {request: Request};
const requestFrom = (request: RequestOrKaitoRequest) => (request instanceof Request ? request : request.request);

export function getRequestMetadata(request: RequestOrKaitoRequest) {
	const metadata = inflightRequestMetadataMap.get(requestFrom(request));

	if (!metadata) {
		throw new Error('Request not found or used after request finished.');
	}

	return metadata;
}

/**
 * Get the remote address (ip address) of the request
 *
 * You can only use this function while a request is in flight.
 *
 * Be warned that if you a serving behind a reverse proxy (like Cloudflare, nginx, etc), this will return the ip address of the proxy, not the client.
 * You should consult the docs of your reverse proxy to see how to get the client's ip address. Usually that is
 * done by looking at a header like `x-forwarded-for` or `cf-connecting-ip`.
 *
 * @returns The remote address of the request
 * @example
 * ```typescript
 * import {getRemoteAddress} from '@kaito-http/uws';
 *
 * await KaitoServer.serve({
 * 	port: 3000,
 * 	fetch: async (request, server) => {
 * 		return new Response(`Your IP is ${server.getRemoteAddress(request)}`);
 * 	}
 * });
 * ```
 */
export function getRemoteAddress(request: RequestOrKaitoRequest) {
	return getRequestMetadata(request).remoteAddress;
}

export class KaitoServer {
	private static getRequestBodyStream(res: uWS.HttpResponse) {
		return new ReadableStream<Uint8Array>({
			start(controller) {
				let buffer: Uint8Array | undefined;

				res.onData((ab, isLast) => {
					const chunk = new Uint8Array(ab.slice(0));

					if (buffer) {
						buffer = new Uint8Array([...buffer, ...chunk]);
					} else {
						buffer = chunk;
					}

					if (isLast) {
						if (buffer) {
							controller.enqueue(buffer);
						}

						controller.close();
					}
				});

				res.onAborted(() => {
					controller.error(new Error('Request aborted'));
				});
			},
		});
	}

	public static async serve(options: ServeUserOptions) {
		const fullOptions = {
			host: '0.0.0.0',
			...options,
		} satisfies ServeOptions;

		const {origin} = new URL('http://' + fullOptions.host + ':' + fullOptions.port);

		const app = uWS.App();

		const staticPromises = Object.entries(fullOptions.static ?? {}).map(async ([path, response]) => {
			const timeout = setTimeout(() => {
				const lines = [
					'KAITO STARTUP WARNING',
					`The static path on ${path} is taking more than 10s to load. This suggests you are waiting for a stream to finish.`,
					'We suggest you do one of the following:',
					'	1. Use `new Response(new Response(stream).arrayBuffer())` if you really need to wait for a stream',
					"	2. Don't use a stream in the first place",
				];

				console.log(lines.join('\n'));
			}, 10000);

			const buffer = await response.arrayBuffer();

			clearTimeout(timeout);

			const statusAsBuffer = Buffer.from(response.status.toString().concat(SPACE, response.statusText));
			const headersFastArray = Array.from(response.headers.entries());

			app.any(path, res => {
				res.writeStatus(statusAsBuffer);

				for (const [header, value] of headersFastArray) {
					res.writeHeader(header, value);
				}

				res.end(buffer);
			});
		});

		await Promise.all(staticPromises);

		app.any('/*', async (res, req) => {
			const controller = new AbortController();

			let aborted = false;
			res.onAborted(() => {
				aborted = true;
				controller.abort();
			});

			const headers = new Headers();
			req.forEach((k, v) => headers.set(k, v));

			const method = req.getMethod();
			//  req.getUrl does not include the query string in the url
			const query = req.getQuery();

			const url = origin.concat(req.getUrl(), query ? '?' + query : '');

			const request = new Request(url, {
				headers,
				method,
				body: method === GET || method === HEAD ? null : this.getRequestBodyStream(res),
				signal: controller.signal,
				// @ts-expect-error undici in Node.js doesn't define the types
				duplex: 'half',
			});

			inflightRequestMetadataMap.set(request, inflightRequestStore(res));
			const response = await options.fetch(request);

			// request was aborted before the handler was finished
			if (aborted) {
				return;
			}

			res.cork(() => {
				res.writeStatus(response.status.toString().concat(SPACE, response.statusText));

				for (const [header, value] of response.headers) {
					res.writeHeader(header, value);
				}

				if (!response.body) {
					res.end();
				}
			});

			if (!response.body) {
				return;
			}

			if (response.headers.has(CONTENT_LENGTH)) {
				const contentLength = parseInt(response.headers.get(CONTENT_LENGTH)!);

				if (contentLength < 65536) {
					res.end(await response.arrayBuffer());
					return;
				}
			}

			const writeNext = async (data: Uint8Array): Promise<void> => {
				if (aborted) {
					return;
				}

				let writeSucceeded: boolean | undefined;
				res.cork(() => {
					writeSucceeded = res.write(data);
				});

				if (!writeSucceeded) {
					return new Promise<void>((resolve, reject) => {
						let offset = 0;

						res.onWritable(availableSpace => {
							let ok: boolean | undefined;

							if (aborted) {
								reject();
								return false;
							}

							res.cork(() => {
								const chunk = data.subarray(offset, offset + availableSpace);
								ok = res.write(chunk);
							});

							if (ok) {
								offset += availableSpace;

								if (offset >= data.length) {
									resolve();
									return false;
								}
							}

							return true;
						});
					});
				}
			};

			try {
				const reader = response.body.getReader();

				while (!aborted) {
					const {done, value} = await reader.read();

					if (done) {
						break;
					}

					if (value) {
						await writeNext(value);
					}
				}
			} finally {
				if (!aborted) {
					res.cork(() => res.end());
				}
			}
		});

		await new Promise<void>((resolve, reject) => {
			app.listen(fullOptions.host, fullOptions.port, ok => {
				if (ok) {
					resolve();
				} else {
					reject(new Error('Failed to listen on port ' + fullOptions.port));
				}
			});
		});

		return new KaitoServer(app, fullOptions);
	}

	private readonly app: ReturnType<typeof uWS.App>;
	private readonly options: ServeOptions;

	private constructor(app: ReturnType<typeof uWS.App>, options: ServeOptions) {
		this.app = app;
		this.options = options;
	}

	public close() {
		this.app.close();
	}

	public get address() {
		return `${this.options.host}:${this.options.port}`;
	}

	public get url() {
		return `http://${this.address}`;
	}
}
