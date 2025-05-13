import type {APIResponse} from './util.ts';

/**
 * This class is merely a wrapper around a `Headers` object and a status code.
 * It's used while the router is executing a route to store any mutations to the status
 * code or headers that the developer may want to make.
 *
 * This exists because there's otherwise no way to indicate back to Kaito that
 * the developer wants to change the status code or headers.
 *
 * @example
 * ```ts
 * const response = new KaitoHead();
 *
 * response.status(200);
 * response.headers.set('Content-Type', 'application/json');
 *
 * console.log(response.headers); // Headers {'content-type': 'application/json'}
 * ```
 */
export class KaitoHead {
	#headers: Headers | null;
	#status: number;

	public constructor() {
		this.#headers = null;
		this.#status = 200;
	}

	public get headers() {
		if (this.#headers === null) {
			this.#headers = new Headers();
		}

		return this.#headers;
	}

	/**
	 * Gets the status code of this KaitoHead instance
	 * @returns The status code
	 */
	public status(): number;

	/**
	 * Sets the status code of this KaitoHead instance
	 * @param status The status code to set
	 * @returns This KaitoHead instance
	 */
	public status(status: number): this;

	public status(status?: number) {
		if (status === undefined) {
			return this.#status;
		}

		this.#status = status;
		return this;
	}

	/**
	 * Turn this KaitoHead instance into a Response instance
	 * @param body The Kaito JSON format to be sent as the response body
	 * @returns A Response instance, ready to be sent
	 */
	public toResponse<T>(body: APIResponse<T>): Response {
		const init: ResponseInit = {
			status: this.#status,
		};

		if (this.#headers) {
			init.headers = this.#headers;
		}

		return Response.json(body, init);
	}

	/**
	 * Whether this KaitoHead instance has been touched/modified
	 */
	public get touched() {
		return this.#status !== 200 || this.#headers !== null;
	}
}
