import type {APIResponse} from './util.ts';

/**
 * This class is similar to a `Response` object from the Web Fetch API, but
 * this with no body stream, and is only used for setting status codes/headers.
 *
 * @example
 * ```ts
 * const response = new KaitoResponse();
 *
 * response.status = 200;
 * response.header('Content-Type', 'application/json');
 *
 * console.log(response.headers); // Headers { 'content-type': 'application/json' }
 * ```
 */
export class KaitoResponse {
	/**
	 * Create a new Response object with JSON body, typed to the standard Kaito JSON format
	 * @param status The status code
	 * @param data The body data
	 * @returns A Response object with JSON body
	 */
	public static json<T>(status: number, data: APIResponse<T>): Response {
		return Response.json(data, {status});
	}

	private _headers: Headers | null;
	private _status: number;

	public constructor() {
		this._headers = null;
		this._status = 200;
	}

	public get headers() {
		if (this._headers === null) {
			this._headers = new Headers();
		}

		return this._headers;
	}

	public header(key: string, value: string) {
		this.headers.set(key, value);
		return this;
	}

	public status(status: number) {
		this._status = status;
		return this;
	}

	/**
	 * Turn this KaitoResponse instance into a Response instance
	 * @param body The Kaito JSON format to be sent as the response body
	 * @returns A Response instance, ready to be sent
	 */
	public toResponse<T>(body: APIResponse<T>): Response {
		const init: ResponseInit = {
			status: this._status,
		};

		if (this._headers) {
			init.headers = this._headers;
		}

		return Response.json(body, init);
	}
}
