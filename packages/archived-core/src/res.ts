import type {CookieSerializeOptions} from 'cookie';
import {serialize} from 'cookie';
import type {ServerResponse} from 'node:http';

export class KaitoResponse {
	constructor(public readonly raw: ServerResponse) {}

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
}
