import {ServerResponse} from 'node:http';
import {serialize, CookieSerializeOptions} from 'cookie';

export type ErroredAPIResponse = {success: false; data: null; message: string};
export type SuccessfulAPIResponse<T> = {success: true; data: T; message: 'OK'};
export type APIResponse<T> = ErroredAPIResponse | SuccessfulAPIResponse<T>;
export type AnyResponse = APIResponse<unknown>;

export class KaitoResponse<T = unknown> {
	public readonly raw: ServerResponse;

	constructor(raw: ServerResponse) {
		this.raw = raw;
	}

	/**
	 * Send a response
	 * @param key The key of the header
	 * @param value The value of the header
	 * @returns The response object
	 */
	header(key: string, value: string | readonly string[]): this {
		this.raw.setHeader(key, value);
		return this;
	}

	/**
	 * Set the status code of the response
	 * @param code The status code
	 * @returns The response object
	 */
	status(code: number): this {
		this.raw.statusCode = code;
		return this;
	}

	/**
	 * Set a cookie
	 * @param name The name of the cookie
	 * @param value The value of the cookie
	 * @param options The options for the cookie
	 * @returns The response object
	 */
	cookie(name: string, value: string, options: CookieSerializeOptions): this {
		this.raw.setHeader('Set-Cookie', serialize(name, value, options));
		return this;
	}

	/**
	 * Send a JSON APIResponse body
	 * @param data The data to send
	 * @returns The response object
	 */
	json(data: APIResponse<T>): this {
		const json = JSON.stringify(data);
		this.raw.setHeader('Content-Type', 'application/json');
		this.raw.setHeader('Content-Length', Buffer.byteLength(json));
		this.raw.end(json);
		return this;
	}
}
