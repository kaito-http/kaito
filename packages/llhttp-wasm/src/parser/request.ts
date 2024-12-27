import * as constants from '../llhttp/build/wasm/constants.js';
import {CallbackReturn, HTTPParser, ParserType} from './http-parser.ts';

export interface ParseOptions {
	secure: boolean;
	host: string;
}

const invertedMethodMap = Object.fromEntries(
	Object.entries(constants.METHODS).map(entry => [entry[1], entry[0]] as const),
);

class BodyStream {
	private stream: ReadableStream<Uint8Array>;
	private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	private chunks: Uint8Array[] = [];
	private closed = false;

	public constructor() {
		this.stream = new ReadableStream<Uint8Array>(
			{
				start: controller => {
					this.controller = controller;

					while (this.chunks.length > 0) {
						const chunk = this.chunks.shift();

						if (chunk) {
							controller.enqueue(chunk);
						}
					}

					if (this.closed) {
						controller.close();
					}
				},
				cancel: () => {
					this.chunks = [];
					this.closed = true;
					this.controller = null;
				},
			},
			{
				highWaterMark: 1,
				size: chunk => chunk.byteLength,
			},
		);
	}

	public get readable(): ReadableStream<Uint8Array> {
		return this.stream;
	}

	public pushChunk(chunk: Uint8Array): void {
		if (this.closed) {
			return;
		}

		if (this.controller) {
			this.controller.enqueue(chunk);
		} else {
			this.chunks.push(chunk);
		}
	}

	public complete(): void {
		if (this.closed) {
			return;
		}

		this.closed = true;

		if (this.controller) {
			this.controller.close();
		}
	}

	public error(err: Error): void {
		if (this.closed) {
			return;
		}

		this.closed = true;

		if (this.controller) {
			this.controller.error(err);
		}
	}
}

export interface RequestMetadata {
	// httpVersionMajor: number;
	// httpVersionMinor: number;
	// httpVersionStr: string;
	shouldKeepAlive: boolean;
}

class HTTPRequestParser extends HTTPParser {
	private options: ParseOptions;
	private stream: BodyStream | null;

	private resolve!: (value: {request: Request; metadata: RequestMetadata}) => void;

	constructor(options: ParseOptions) {
		super(ParserType.REQUEST);

		this.options = options;
		this.stream = null;
	}

	private getOrCreateStream() {
		if (this.stream) {
			return this.stream;
		}

		this.stream = new BodyStream();
		return this.stream;
	}

	override onRequest(
		// versionMajor: number,
		// versionMinor: number,
		// headersAsMap: Record<string, string>,
		headers: Headers,
		methodNum: number,
		path: string,
		// upgrade: boolean,
		shouldKeepAlive: boolean,
	): number {
		const methodString = invertedMethodMap[methodNum];

		const full = `${this.options.secure ? 'https' : 'http'}://${this.options.host}${path}`;

		const request = new Request(full, {
			body: methodString === 'HEAD' || methodString === 'GET' ? null : this.getOrCreateStream().readable,
			method: methodString,
			headers,
			// keepalive: shouldKeepAlive,

			// @ts-expect-error
			duplex: 'half',
		});

		this.resolve({
			request,
			metadata: {
				shouldKeepAlive,
			},
		});

		return CallbackReturn.OK;
	}

	override onBody(chunk: Buffer): number {
		try {
			this.getOrCreateStream().pushChunk(new Uint8Array(chunk));
			return CallbackReturn.OK;
		} catch (err) {
			this.getOrCreateStream().error(err instanceof Error ? err : new Error(String(err)));
			return CallbackReturn.ERROR;
		}
	}

	public override onMessageComplete(): number {
		try {
			this.stream?.complete();
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.stream?.error(error);
		}

		return CallbackReturn.OK;
	}

	private parse(data: Buffer): Promise<{
		request: Request;
		metadata: RequestMetadata;
	}> {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;

			try {
				this.execute(data);
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				this.stream?.error(error);
				reject(error);
			}
		});
	}

	public static async parse(
		data: Buffer,
		options: ParseOptions,
	): Promise<{request: Request; metadata: RequestMetadata}> {
		const parser = new HTTPRequestParser(options);

		try {
			return await parser.parse(data);
		} finally {
			parser.destroy();
		}
	}
}

export {HTTPRequestParser};
