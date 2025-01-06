import uWS from 'uWebSockets.js';

export interface ServeOptions {
	port: number;
	host?: string;
	fetch: (request: Request) => Promise<Response>;
}

const BASE = 'http://kaito';
const SPACE = ' ';
const GET = 'get';
const HEAD = 'head';
const CONTENT_LENGTH = 'content-length';

export class KaitoServer {
	private static getRequestBodyStream(res: uWS.HttpResponse) {
		return new ReadableStream({
			start(controller) {
				let buffer: Buffer | undefined;

				res.onData((ab, isLast) => {
					const chunk = Buffer.from(ab);

					if (buffer) {
						buffer = Buffer.concat([buffer, chunk]);
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

	public static serve(options: ServeOptions) {
		const app = uWS.App().any('/*', async (res, req) => {
			const headers = new Headers();

			req.forEach((key, value) => {
				headers.set(key, value);
			});

			const method = req.getMethod();
			const url = BASE.concat(req.getUrl());

			const request = new Request(url, {
				headers,
				method,
				body: method === GET || method === HEAD ? null : this.getRequestBodyStream(res),
			});

			const response = await options.fetch(request);

			res.writeStatus(response.status.toString().concat(SPACE, response.statusText));

			for (const [header, value] of response.headers) {
				res.writeHeader(header, value);
			}

			const body = response.body;
			if (!body) {
				res.end();
				return;
			}

			if (response.headers.has(CONTENT_LENGTH)) {
				const contentLength = parseInt(response.headers.get(CONTENT_LENGTH)!);
				if (contentLength < 65536) {
					res.end(await response.arrayBuffer());
					return;
				}
			}

			const reader = body.getReader();

			const writeNext = async (data: Uint8Array): Promise<void> => {
				const writeSucceeded = res.write(data);

				if (!writeSucceeded) {
					return new Promise(resolve => {
						let offset = 0;
						res.onWritable(availableSpace => {
							const chunk = data.subarray(offset, offset + availableSpace);
							const ok = res.write(chunk);

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

			const pump = async () => {
				try {
					while (true) {
						const {done, value} = await reader.read();

						if (done) {
							break;
						}

						if (value) {
							await writeNext(value);
						}
					}

					res.end();
				} catch {
					res.end();
				}
			};

			pump();
		});

		const instance = new KaitoServer(app, options);

		return new Promise<KaitoServer>((resolve, reject) => {
			app.listen(options.port, ok => {
				if (ok) {
					resolve(instance);
				} else {
					reject(new Error('Failed to listen on port ' + options.port));
				}
			});
		});
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
