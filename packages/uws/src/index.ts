import uWS from 'uWebSockets.js';

export interface ServeOptions {
	port: number;
	fetch: (request: Request) => Promise<Response>;
}

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

	private static BASE = 'http://kaito';

	public static serve(options: ServeOptions) {
		const app = uWS.App().any('/*', async (res, req) => {
			const headers = new Headers();

			req.forEach((key, value) => {
				headers.set(key, value);
			});

			const method = req.getMethod();
			const url = this.BASE.concat(req.getUrl());

			const request = new Request(url, {
				headers,
				method,
				body: method === 'get' || method === 'head' ? null : this.getRequestBodyStream(res),
			});

			const response = await options.fetch(request);

			res.writeStatus(response.status.toString().concat(' ', response.statusText));

			for (const [header, value] of headers) {
				res.writeHeader(header, value);
			}

			await response.body?.pipeTo(
				new WritableStream({
					write(chunk) {
						res.write(chunk);
					},
				}),
			);

			res.end();
		});

		const instance = new KaitoServer(app);

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

	private constructor(app: ReturnType<typeof uWS.App>) {
		this.app = app;
	}

	public close() {
		this.app.close();
	}
}
