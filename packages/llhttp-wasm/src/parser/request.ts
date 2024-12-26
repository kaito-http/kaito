import {CallbackReturn, HTTPParser, ParserType} from './http-parser';

type RequestWithBody = Request & {
	httpVersion: string;
	rawBodyStream: ReadableStream<Uint8Array>;
};

class BodyStream extends ReadableStream<Uint8Array> {
	private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	private chunks: Uint8Array[] = [];
	private closed = false;

	constructor() {
		let controller: ReadableStreamDefaultController<Uint8Array>;

		super(
			{
				start: c => {
					controller = c;
					this.controller = c;

					// If we have queued chunks, send them immediately
					while (this.chunks.length > 0) {
						const chunk = this.chunks.shift();
						if (chunk) controller.enqueue(chunk);
					}

					if (this.closed) controller.close();
				},

				pull: async controller => {
					// Implement backpressure by waiting if needed
					await new Promise(resolve => setTimeout(resolve, 0));
				},

				cancel: () => {
					this.chunks = [];
					this.closed = true;
					this.controller = null;
				},
			},
			{
				highWaterMark: 1,
				size: (chunk: Uint8Array) => chunk.byteLength,
			},
		);
	}

	public pushChunk(chunk: Uint8Array): void {
		if (this.closed) return;

		if (this.controller) {
			this.controller.enqueue(chunk);
		} else {
			this.chunks.push(chunk);
		}
	}

	public complete(): void {
		if (this.closed) return;

		this.closed = true;
		if (this.controller) {
			this.controller.close();
		}
	}

	public error(err: Error): void {
		if (this.closed) return;

		this.closed = true;
		if (this.controller) {
			this.controller.error(err);
		}
	}
}

class HTTPRequestParser extends HTTPParser {
	private url = '';
	private method = '';
	private headers = new Headers();
	private bodyStream: BodyStream;
	private resolve!: (value: RequestWithBody) => void;
	private reject!: (reason: Error) => void;
	private httpMajor = 1;
	private httpMinor = 1;

	constructor() {
		super(ParserType.REQUEST);
		this.bodyStream = new BodyStream();
	}

	protected override onRequest(
		versionMajor: number,
		versionMinor: number,
		headers: Record<string, string>,
		rawHeaders: string[],
		methodNum: number,
		url: string,
		upgrade: boolean,
		shouldKeepAlive: boolean,
	): number {
		this.httpMajor = versionMajor;
		this.httpMinor = versionMinor;
		this.url = url;

		const methods = [
			'DELETE',
			'GET',
			'HEAD',
			'POST',
			'PUT',
			'CONNECT',
			'OPTIONS',
			'TRACE',
			'COPY',
			'LOCK',
			'MKCOL',
			'MOVE',
			'PROPFIND',
			'PROPPATCH',
			'UNLOCK',
			'REPORT',
			'MKACTIVITY',
			'CHECKOUT',
			'MERGE',
			'M-SEARCH',
			'NOTIFY',
			'SUBSCRIBE',
			'UNSUBSCRIBE',
			'PATCH',
		];
		this.method = methods[methodNum - 1] || 'GET';

		for (let i = 0; i < rawHeaders.length; i += 2) {
			this.headers.append(rawHeaders[i], rawHeaders[i + 1]);
		}

		return CallbackReturn.OK;
	}

	protected override onBody(chunk: Buffer): number {
		try {
			this.bodyStream.pushChunk(new Uint8Array(chunk));
			return CallbackReturn.OK;
		} catch (err) {
			this.bodyStream.error(err instanceof Error ? err : new Error(String(err)));
			return CallbackReturn.ERROR;
		}
	}

	protected override onMessageComplete(): number {
		try {
			const host = this.headers.get('host') || 'localhost';
			const protocol = this.headers.get('x-forwarded-proto') || 'http';
			const fullUrl = new URL(this.url, `${protocol}://${host}`);

			// Create a cloned stream for the Request body
			const requestStream = this.bodyStream;
			this.bodyStream.complete();

			const request = new Request(fullUrl.toString(), {
				method: this.method,
				headers: this.headers,
				body: this.method !== 'GET' && this.method !== 'HEAD' ? requestStream : null,
				duplex: 'half',
			}) as RequestWithBody;

			Object.defineProperties(request, {
				httpVersion: {
					value: `${this.httpMajor}.${this.httpMinor}`,
					enumerable: true,
					configurable: true,
				},
				rawBodyStream: {
					value: requestStream,
					enumerable: true,
					configurable: true,
				},
			});

			this.resolve(request);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.bodyStream.error(error);
			this.reject(error);
		}

		return CallbackReturn.OK;
	}

	public parseRequest(data: Buffer): Promise<RequestWithBody> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			try {
				this.execute(data);
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				this.bodyStream.error(error);
				reject(error);
			}
		});
	}

	public static async parse(data: Buffer): Promise<RequestWithBody> {
		const parser = new HTTPRequestParser();
		try {
			return await parser.parseRequest(data);
		} finally {
			parser.destroy();
		}
	}
}

// Initialize once at startup
export async function initializeParser(wasmPath: string): Promise<void> {
	await HTTPParser.initialize(wasmPath);
}

export {HTTPRequestParser};
