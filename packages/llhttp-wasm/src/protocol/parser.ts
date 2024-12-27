import {Buffer} from 'buffer';
import {wasmBase64} from '../llhttp/base64.ts';
import * as constants from '../llhttp/build/wasm/constants.js';

export const ParserType = {
	REQUEST: 1,
};

export type ParserType = (typeof ParserType)[keyof typeof ParserType];

export const CallbackReturn = {
	OK: 0,
	ERROR: 1,
};

export type CallbackReturn = (typeof CallbackReturn)[keyof typeof CallbackReturn];

export interface RequestMetadata {
	shouldKeepAlive: boolean;
}

export interface ParseOptions {
	secure: boolean;
	host: string;
}

type WASMExports = {
	memory: WebAssembly.Memory;
	llhttp_alloc: (type: number) => number;
	malloc: (size: number) => number;
	free: (ptr: number) => void;
	llhttp_execute: (parser: number, data: number, len: number) => number;
	llhttp_get_method: (parser: number) => number;
	llhttp_should_keep_alive: (parser: number) => number;
	llhttp_get_error_reason: (parser: number) => number;
	_initialize?: () => void;
};

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
					for (const chunk of this.chunks) {
						controller.enqueue(chunk);
					}
					this.chunks = [];
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

	get readable(): ReadableStream<Uint8Array> {
		return this.stream;
	}

	pushChunk(chunk: Uint8Array): void {
		if (this.closed) return;
		if (this.controller) {
			this.controller.enqueue(chunk);
		} else {
			this.chunks.push(chunk);
		}
	}

	complete(): void {
		if (this.closed) return;
		this.closed = true;
		if (this.controller) {
			this.controller.close();
		}
	}

	error(err: Error): void {
		if (this.closed) return;
		this.closed = true;
		if (this.controller) {
			this.controller.error(err);
		}
	}
}

const ptrToString = (memory: WebAssembly.Memory, ptr: number, len: number): string =>
	Buffer.from(new Uint8Array(memory.buffer, ptr, len)).toString();

const invertedMethodMap = Object.fromEntries(
	Object.entries(constants.METHODS).map(entry => [entry[1], entry[0]] as const),
);

const wasmModule = new WebAssembly.Module(Buffer.from(wasmBase64, 'base64'));

export class HTTPRequestParser {
	private static instanceMap = new Map<number, HTTPRequestParser>();
	private static wasmInstance: WebAssembly.Instance;

	private ptr: number;
	private url = '';
	private headerFields: string[] = [];
	private headerValues: string[] = [];
	private options: ParseOptions;
	private stream: BodyStream | null = null;
	private resolve!: (value: {request: Request; metadata: RequestMetadata}) => void;

	static {
		this.wasmInstance = new WebAssembly.Instance(wasmModule, {
			env: {
				wasm_on_message_begin: (parser: number) => {
					const instance = HTTPRequestParser.instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance.reset();
					return CallbackReturn.OK;
				},
				wasm_on_url: (parser: number, at: number, length: number) => {
					const instance = HTTPRequestParser.instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance.url = ptrToString((HTTPRequestParser.wasmInstance.exports as WASMExports).memory, at, length);
					return CallbackReturn.OK;
				},
				wasm_on_status: (/*parser: number, at: number, length: number*/) => {
					// const instance = HTTPRequestParser.instanceMap.get(parser);
					// if (!instance) return CallbackReturn.ERROR;
					// instance[kStatusMessage] = ptrToString(
					// 	(HTTPRequestParser.wasmInstance.exports as WASMExports).memory,
					// 	at,
					// 	length,
					// );
					return CallbackReturn.OK;
				},
				wasm_on_header_field: (parser: number, at: number, length: number) => {
					const instance = HTTPRequestParser.instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance.headerFields.push(
						ptrToString((HTTPRequestParser.wasmInstance.exports as WASMExports).memory, at, length),
					);
					return CallbackReturn.OK;
				},
				wasm_on_header_value: (parser: number, at: number, length: number) => {
					const instance = HTTPRequestParser.instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance.headerValues.push(
						ptrToString((HTTPRequestParser.wasmInstance.exports as WASMExports).memory, at, length),
					);
					return CallbackReturn.OK;
				},
				wasm_on_headers_complete: (parser: number) => {
					const instance = HTTPRequestParser.instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					return instance.onHeadersComplete();
				},
				wasm_on_body: (parser: number, at: number, length: number) => {
					const instance = HTTPRequestParser.instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					return instance.onBody(
						Buffer.from(
							new Uint8Array((HTTPRequestParser.wasmInstance.exports as WASMExports).memory.buffer, at, length),
						),
					);
				},
				wasm_on_message_complete: (parser: number) => {
					const instance = HTTPRequestParser.instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					return instance.onMessageComplete();
				},
			},
		});

		(this.wasmInstance.exports._initialize as CallableFunction)();
	}

	private constructor(options: ParseOptions) {
		this.options = options;
		this.ptr = (HTTPRequestParser.wasmInstance.exports as WASMExports).llhttp_alloc(ParserType.REQUEST);
		HTTPRequestParser.instanceMap.set(this.ptr, this);
	}

	private reset(): void {
		this.url = '';
		this.headerFields = [];
		this.headerValues = [];
	}

	private checkError(code: number): void {
		if (code === 0) return;
		const ptr = (HTTPRequestParser.wasmInstance.exports as WASMExports).llhttp_get_error_reason(this.ptr);
		const memory = new Uint8Array((HTTPRequestParser.wasmInstance.exports as WASMExports).memory.buffer);
		const length = memory.indexOf(0, ptr) - ptr;
		throw new Error(ptrToString((HTTPRequestParser.wasmInstance.exports as WASMExports).memory, ptr, length));
	}

	private execute(data: Buffer): number {
		const ptr = (HTTPRequestParser.wasmInstance.exports as WASMExports).malloc(data.byteLength);
		const memory = new Uint8Array((HTTPRequestParser.wasmInstance.exports as WASMExports).memory.buffer);
		memory.set(data, ptr);

		const result = (HTTPRequestParser.wasmInstance.exports as WASMExports).llhttp_execute(this.ptr, ptr, data.length);
		(HTTPRequestParser.wasmInstance.exports as WASMExports).free(ptr);

		this.checkError(result);
		return result;
	}

	private getOrCreateStream(): BodyStream {
		if (!this.stream) {
			this.stream = new BodyStream();
		}
		return this.stream;
	}

	private onHeadersComplete(): number {
		const exports = HTTPRequestParser.wasmInstance.exports as WASMExports;
		const shouldKeepAlive = Boolean(exports.llhttp_should_keep_alive(this.ptr));
		const methodNum = exports.llhttp_get_method(this.ptr);
		const methodString = invertedMethodMap[methodNum];

		const headers = new Headers();
		for (let i = 0; i < this.headerFields.length; i++) {
			headers.append(this.headerFields[i]!, this.headerValues[i]!);
		}

		const fullUrl = `${this.options.secure ? 'https' : 'http'}://${this.options.host}${this.url}`;
		const request = new Request(fullUrl, {
			body: methodString === 'HEAD' || methodString === 'GET' ? null : this.getOrCreateStream().readable,
			method: methodString,
			headers,
			// @ts-expect-error
			duplex: 'half',
		});

		this.resolve({
			request,
			metadata: {shouldKeepAlive},
		});

		return CallbackReturn.OK;
	}

	private onBody(chunk: Buffer): number {
		try {
			this.getOrCreateStream().pushChunk(new Uint8Array(chunk));
			return CallbackReturn.OK;
		} catch (err) {
			this.getOrCreateStream().error(err instanceof Error ? err : new Error(String(err)));
			return CallbackReturn.ERROR;
		}
	}

	private onMessageComplete(): number {
		try {
			this.stream?.complete();
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.stream?.error(error);
		}
		return CallbackReturn.OK;
	}

	private async parse(data: Buffer): Promise<{
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

	public destroy(): void {
		HTTPRequestParser.instanceMap.delete(this.ptr);
		(HTTPRequestParser.wasmInstance.exports as WASMExports).free(this.ptr);
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
