import {wasmBase64} from '../llhttp/troll.ts';

// We'll export these for users of the parser
export const enum ParserType {
	REQUEST = 1,
	RESPONSE = 2,
}

export const enum CallbackReturn {
	OK = 0,
	ERROR = 1,
}

const kPtr = Symbol('kPtr');
const kUrl = Symbol('kUrl');
const kStatusMessage = Symbol('kStatusMessage');
const kHeaderFields = Symbol('kHeaderFields');
const kHeaderValues = Symbol('kHeaderValues');
const kBody = Symbol('kBody');
const kReset = Symbol('kReset');
const kCheckError = Symbol('kCheckError');

type WASMExports = {
	memory: WebAssembly.Memory;
	llhttp_alloc: (type: number) => number;
	malloc: (size: number) => number;
	free: (ptr: number) => void;
	llhttp_execute: (parser: number, data: number, len: number) => number;
	llhttp_get_type: (parser: number) => number;
	llhttp_get_upgrade: (parser: number) => number;
	llhttp_should_keep_alive: (parser: number) => number;
	llhttp_get_method: (parser: number) => number;
	llhttp_get_status_code: (parser: number) => number;
	llhttp_get_http_major: (parser: number) => number;
	llhttp_get_http_minor: (parser: number) => number;
	llhttp_get_error_reason: (parser: number) => number;
	_initialize?: () => void;
};

const instanceMap = new Map<number, HTTPParser>();

// Convert WASM memory pointer to string
const ptrToString = (memory: WebAssembly.Memory, ptr: number, len: number): string =>
	Buffer.from(new Uint8Array(memory.buffer, ptr, len)).toString();

export abstract class HTTPParser {
	private static wasmInstance: WebAssembly.Instance;
	private static exports: WASMExports;
	private static initialized = false;

	public static async initialize(): Promise<void> {
		if (this.initialized) return;

		const buf = Buffer.from(wasmBase64, 'base64');
		const wasmModule = await WebAssembly.compile(buf);

		this.wasmInstance = await WebAssembly.instantiate(wasmModule, {
			env: {
				wasm_on_message_begin: (parser: number) => {
					const instance = instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance[kReset]();
					return CallbackReturn.OK;
				},
				wasm_on_url: (parser: number, at: number, length: number) => {
					const instance = instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance[kUrl] = ptrToString(HTTPParser.exports.memory, at, length);
					return CallbackReturn.OK;
				},
				wasm_on_status: (parser: number, at: number, length: number) => {
					const instance = instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance[kStatusMessage] = ptrToString(HTTPParser.exports.memory, at, length);
					return CallbackReturn.OK;
				},
				wasm_on_header_field: (parser: number, at: number, length: number) => {
					const instance = instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance[kHeaderFields].push(ptrToString(HTTPParser.exports.memory, at, length));
					return CallbackReturn.OK;
				},
				wasm_on_header_value: (parser: number, at: number, length: number) => {
					const instance = instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance[kHeaderValues].push(ptrToString(HTTPParser.exports.memory, at, length));
					return CallbackReturn.OK;
				},
				wasm_on_headers_complete: (parser: number) => {
					const instance = instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					return instance.onHeadersComplete();
				},
				wasm_on_body: (parser: number, at: number, length: number) => {
					const instance = instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					instance[kBody] = Buffer.from(new Uint8Array(HTTPParser.exports.memory.buffer, at, length));
					return instance.onBody(instance[kBody]);
				},
				wasm_on_message_complete: (parser: number) => {
					const instance = instanceMap.get(parser);
					if (!instance) return CallbackReturn.ERROR;
					return instance.onMessageComplete();
				},
			},
		});

		this.exports = this.wasmInstance.exports as unknown as WASMExports;

		// Initialize WASI reactor if needed
		if (this.exports._initialize) {
			this.exports._initialize();
		}

		this.initialized = true;
	}

	private [kPtr]: number;
	private [kUrl]: string = '';
	private [kStatusMessage]: string | null = null;
	private [kHeaderFields]: string[] = [];
	private [kHeaderValues]: string[] = [];
	private [kBody]: Buffer | null = null;

	public constructor(type: ParserType) {
		if (!HTTPParser.initialized) {
			throw new Error('HTTPParser must be initialized before instantiation');
		}

		this[kPtr] = HTTPParser.exports.llhttp_alloc(type);
		instanceMap.set(this[kPtr], this);
	}

	private [kReset](): void {
		this[kUrl] = '';
		this[kStatusMessage] = null;
		this[kHeaderFields] = [];
		this[kHeaderValues] = [];
		this[kBody] = null;
	}

	private [kCheckError](code: number): void {
		if (code === 0) return;

		const ptr = HTTPParser.exports.llhttp_get_error_reason(this[kPtr]);
		const memory = new Uint8Array(HTTPParser.exports.memory.buffer);
		const length = memory.indexOf(0, ptr) - ptr;
		throw new Error(ptrToString(HTTPParser.exports.memory, ptr, length));
	}

	public execute(data: Buffer): number {
		const ptr = HTTPParser.exports.malloc(data.byteLength);
		const memory = new Uint8Array(HTTPParser.exports.memory.buffer);
		memory.set(data, ptr);

		const result = HTTPParser.exports.llhttp_execute(this[kPtr], ptr, data.length);
		HTTPParser.exports.free(ptr);

		this[kCheckError](result);
		return result;
	}

	protected onHeadersComplete(): number {
		const type = HTTPParser.exports.llhttp_get_type(this[kPtr]);
		const versionMajor = HTTPParser.exports.llhttp_get_http_major(this[kPtr]);
		const versionMinor = HTTPParser.exports.llhttp_get_http_minor(this[kPtr]);
		const upgrade = Boolean(HTTPParser.exports.llhttp_get_upgrade(this[kPtr]));
		const shouldKeepAlive = Boolean(HTTPParser.exports.llhttp_should_keep_alive(this[kPtr]));

		const headers: Record<string, string> = {};
		const rawHeaders: string[] = [];

		for (let i = 0; i < this[kHeaderFields].length; i++) {
			const field = this[kHeaderFields][i];
			const value = this[kHeaderValues][i];
			headers[field!.toLowerCase()] = value!;
			rawHeaders.push(field!, value!);
		}

		if (type === ParserType.REQUEST) {
			const method = HTTPParser.exports.llhttp_get_method(this[kPtr]);
			return this.onRequest(
				versionMajor,
				versionMinor,
				headers,
				rawHeaders,
				method,
				this[kUrl],
				upgrade,
				shouldKeepAlive,
			);
		} else {
			const statusCode = HTTPParser.exports.llhttp_get_status_code(this[kPtr]);
			return this.onResponse(
				versionMajor,
				versionMinor,
				headers,
				rawHeaders,
				statusCode,
				this[kStatusMessage] || '',
				upgrade,
				shouldKeepAlive,
			);
		}
	}

	protected abstract onRequest(
		versionMajor: number,
		versionMinor: number,
		headers: Record<string, string>,
		rawHeaders: string[],
		method: number,
		url: string,
		upgrade: boolean,
		shouldKeepAlive: boolean,
	): CallbackReturn;

	abstract onResponse(
		versionMajor: number,
		versionMinor: number,
		headers: Record<string, string>,
		rawHeaders: string[],
		statusCode: number,
		statusMessage: string,
		upgrade: boolean,
		shouldKeepAlive: boolean,
	): CallbackReturn;

	protected abstract onBody(chunk: Buffer): CallbackReturn;

	protected abstract onMessageComplete(): CallbackReturn;

	public destroy(): void {
		instanceMap.delete(this[kPtr]);
		HTTPParser.exports.free(this[kPtr]);
	}

	public getURL(): string {
		return this[kUrl];
	}

	public get statusMessage(): string | null {
		return this[kStatusMessage];
	}

	public get body(): Buffer | null {
		return this[kBody];
	}
}
