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

const invertedMethodMap = Object.fromEntries(
	Object.entries(constants.METHODS).map(entry => [entry[1], entry[0]] as const),
);

class HTTPRequestParser extends HTTPParser {
	private headers = new Headers();
	private bodyStream: BodyStream;

	private resolve!: (value: Request) => void;
	private reject!: (reason: Error) => void;

	constructor() {
		super(ParserType.REQUEST);
		this.bodyStream = new BodyStream();
	}

	public override onResponse(): CallbackReturn {
		throw new Error('onResponse() is not supported in the HTTPRequestParser');
	}

	private static headersObjectToHeaders(headers: Record<string, string>): Headers {
		const headersInstance = new Headers();
		for (const [key, value] of Object.entries(headers)) {
			headersInstance.append(key, value);
		}
		return headersInstance;
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
		const methodString = invertedMethodMap[methodNum];

		const request = new Request(url, {
			body: this.bodyStream.readable,
			method: methodString,
			headers: HTTPRequestParser.headersObjectToHeaders(headers),
			keepalive: shouldKeepAlive,

			// @ts-expect-error
			duplex: 'half',
		});

		this.resolve(request);

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
			this.bodyStream.complete();
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.bodyStream.error(error);
		}

		return CallbackReturn.OK;
	}

	public parse(data: Buffer): Promise<Request> {
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

	public static async parse(data: Buffer): Promise<Request> {
		const parser = new HTTPRequestParser();

		try {
			return await parser.parse(data);
		} finally {
			parser.destroy();
		}
	}
}

export {HTTPRequestParser};

await HTTPParser.initialize();

const r = await HTTPRequestParser.parse(
	Buffer.from(['POST /owo HTTP/1.1', 'X: Y', 'Content-Length: 9', '', 'uh, meow?', ''].join('\r\n')),
);

console.log(r);
