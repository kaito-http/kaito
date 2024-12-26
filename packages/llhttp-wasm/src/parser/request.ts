import * as constants from '../llhttp/build/wasm/constants.js';
import {CallbackReturn, HTTPParser, ParserType} from './http-parser.ts';

class BodyStream {
	private stream: ReadableStream<Uint8Array>;
	private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	private chunks: Uint8Array[] = [];
	private closed = false;

	constructor() {
		this.stream = new ReadableStream<Uint8Array>(
			{
				start: controller => {
					this.controller = controller;
					while (this.chunks.length > 0) {
						const chunk = this.chunks.shift();
						if (chunk) controller.enqueue(chunk);
					}
					if (this.closed) controller.close();
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

	public get readable(): ReadableStream<Uint8Array> {
		return this.stream;
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

export interface ParseOptions {
	secure: boolean;
	hostname: string;
}

const invertedMethodMap = Object.fromEntries(
	Object.entries(constants.METHODS).map(entry => [entry[1], entry[0]] as const),
);

class HTTPRequestParser extends HTTPParser {
	private options: ParseOptions;
	private bodyStream: BodyStream | null;

	private resolve!: (value: Request) => void;

	constructor(options: ParseOptions) {
		super(ParserType.REQUEST);
		this.options = options;
		this.bodyStream = null;
	}

	private static headersObjectToHeaders(headers: Record<string, string>): Headers {
		const headersInstance = new Headers();
		for (const [key, value] of Object.entries(headers)) {
			headersInstance.append(key, value);
		}
		return headersInstance;
	}

	private getBodyStream() {
		if (this.bodyStream) {
			return this.bodyStream;
		}

		this.bodyStream = new BodyStream();
		return this.bodyStream;
	}

	override onRequest(
		versionMajor: number,
		versionMinor: number,
		headersAsMap: Record<string, string>,
		// rawHeaders: string[],
		methodNum: number,
		url: string,
		// upgrade: boolean,
		// shouldKeepAlive: boolean,
	): number {
		const methodString = invertedMethodMap[methodNum];

		const protocol = this.options.secure ? 'https' : 'http';
		const fullUrl = new URL(url, `${protocol}://${this.options.hostname}`);

		const request = new Request(fullUrl, {
			body: methodString === 'HEAD' || methodString === 'GET' ? null : this.getBodyStream().readable,
			method: methodString,
			headers: HTTPRequestParser.headersObjectToHeaders(headersAsMap),
			// keepalive: shouldKeepAlive,

			// @ts-expect-error
			duplex: 'half',
		});

		Object.defineProperties(request, {
			httpVersion: {
				value: `${versionMajor}.${versionMinor}`,
				enumerable: true,
				configurable: true,
			},
			_kaito_parsed_url: {
				value: fullUrl,
				enumerable: true,
				configurable: true,
				writable: false,
			},
		});

		this.resolve(request);

		return CallbackReturn.OK;
	}

	override onBody(chunk: Buffer): number {
		try {
			this.getBodyStream().pushChunk(new Uint8Array(chunk));
			return CallbackReturn.OK;
		} catch (err) {
			this.getBodyStream().error(err instanceof Error ? err : new Error(String(err)));
			return CallbackReturn.ERROR;
		}
	}

	public override onMessageComplete(): number {
		try {
			this.getBodyStream().complete();
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.getBodyStream().error(error);
		}

		return CallbackReturn.OK;
	}

	public parse(data: Buffer): Promise<Request> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;

			try {
				this.execute(data);
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				this.getBodyStream().error(error);
				reject(error);
			}
		});
	}

	public static async parse(data: Buffer, options: ParseOptions): Promise<Request> {
		const parser = new HTTPRequestParser(options);

		try {
			return await parser.parse(data);
		} finally {
			parser.destroy();
		}
	}
}

export {HTTPRequestParser};

// const text = JSON.stringify({alistair: true, landon: true});

// const r = await HTTPRequestParser.parse(
// 	Buffer.from(['POST /owo?name=true HTTP/1.1', 'X: Y', `Content-Length: ${text.length}`, '', text, ''].join('\r\n')),
// 	{
// 		secure: false,
// 		hostname: '127.0.0.1',
// 	},
// );

// console.log(await r.json());
