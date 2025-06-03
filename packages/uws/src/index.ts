import uWS from 'uWebSockets.js';

export interface RequestContext {
	/**
	 * The remote address of the client
	 */
	remoteAddress: string;
}

export interface ServeOptions {
	/**
	 * The port to listen on
	 */
	port: number;

	/**
	 * The host to listen on
	 */
	host: string;

	// static?: Record<`/${string}`, Response>;

	/**
	 * This function is called for every request.
	 *
	 * @param request - The request that was made
	 * @returns A response to send to the client
	 */
	fetch: (request: Request, context: RequestContext) => Response | PromiseLike<Response>;

	/**
	 * This function is called when an error occurs in the fetch handler.
	 *
	 * @param error - The error that occurred
	 * @param request - The request that caused the error
	 * @returns A response to send to the client
	 */
	onError: (error: unknown, request: Request) => Response | PromiseLike<Response>;
}

type ExpandOptions<T> = {[K in keyof T]: T[K]} & {};
export type ServeUserOptions = ExpandOptions<
	Omit<ServeOptions, 'host' | 'onError'> & Partial<Pick<ServeOptions, 'host' | 'onError'>>
>;

async function asyncTry<T, A extends unknown[] = []>(fn: (...args: A) => T | PromiseLike<T>, ...args: A): Promise<T> {
	try {
		return await fn(...args);
	} catch (error) {
		throw error;
	}
}

const SPACE = ' ';
const GET = 'get';
const HEAD = 'head';
const CONTENT_LENGTH = 'content-length';
const QMARK = '?';
const EMPTY = '';

function context(res: uWS.HttpResponse): RequestContext {
	return {
		get remoteAddress() {
			const value = Buffer.from(res.getRemoteAddressAsText()).toString('ascii');
			Object.defineProperty(this, 'remoteAddress', {value});
			return value;
		},
	};
}

/**
 * The main class for creating a Kaito server
 */
export class KaitoServer implements Disposable {
	private static getRequestBodyStream(res: uWS.HttpResponse) {
		return new ReadableStream<Uint8Array>({
			start(controller) {
				res.onData((ab, isLast) => {
					const chunk = new Uint8Array(ab.slice(0));

					controller.enqueue(chunk);

					if (isLast) {
						controller.close();
					}
				});

				res.onAborted(() => {
					controller.error(new Error('Request aborted'));
				});
			},
		});
	}

	// this function must not throw by any means
	private static readonly DEFAULT_ON_ERROR: ServeOptions['onError'] = error => {
		console.error('[@kaito-http/uws] Error in fetch handler:');
		console.error(error);

		return new Response('Internal Server Error', {
			status: 500,
			statusText: 'Internal Server Error',
		});
	};

	/**
	 * Create a new Kaito server
	 *
	 * @param options - The options for the server
	 * @returns A Kaito server instance
	 * @example
	 * ```typescript
	 * using server = await KaitoServer.serve({
	 *   port: 3000,
	 *   fetch: async request => new Response('Hello, world!'),
	 * });
	 * ```
	 */
	public static async serve(options: ServeUserOptions) {
		const fullOptions: ServeOptions = {
			host: '0.0.0.0',
			onError: this.DEFAULT_ON_ERROR,
			...options,
		};

		const {origin} = new URL('http://' + fullOptions.host + ':' + fullOptions.port);

		const app = uWS.App();

		// for await (const [path, response] of Object.entries(fullOptions.static ?? {})) {
		// 	const buffer = await response.arrayBuffer();
		// 	const statusAsBuffer = Buffer.from(response.status.toString().concat(SPACE, response.statusText));
		// 	const headersFastArray = Array.from(response.headers.entries());

		// 	app.any(path, res => {
		// 		res.writeStatus(statusAsBuffer);
		// 		for (const [header, value] of headersFastArray) {
		// 			res.writeHeader(header, value);
		// 		}
		// 		res.end(buffer);
		// 	});
		// }

		app.any('/*', async (res, req) => {
			const headers = new Headers();
			req.forEach((k, v) => headers.set(k, v));

			const method = req.getMethod();
			//  req.getUrl does not include the query string in the url
			const query = req.getQuery();

			const url = origin.concat(req.getUrl(), query ? QMARK + query : EMPTY);

			const controller = new AbortController();

			const request = new Request(url, {
				headers,
				method,
				body: method === GET || method === HEAD ? null : this.getRequestBodyStream(res),
				signal: controller.signal,
				// @ts-expect-error undici in Node.js doesn't define the types
				duplex: 'half',
			});

			res.onAborted(() => {
				controller.abort();
			});

			const response = await asyncTry(options.fetch, request, context(res))
				.catch(error => fullOptions.onError(error, request))
				.catch(error => this.DEFAULT_ON_ERROR(error, request));

			// request was aborted before the handler was finished
			if (controller.signal.aborted) {
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
				if (controller.signal.aborted) {
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

							if (controller.signal.aborted) {
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

				while (!controller.signal.aborted) {
					const {done, value} = await reader.read();

					if (done) {
						break;
					}

					if (value) {
						await writeNext(value);
					}
				}
			} finally {
				if (!controller.signal.aborted) {
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

	[Symbol.dispose](): void {
		return this.close();
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
