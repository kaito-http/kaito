import type {APIResponse, ErroredAPIResponse, InferRoutes, KaitoMethod, Router} from '@kaito-http/core';
import type {KaitoSSEResponse, SSEEvent} from '@kaito-http/core/stream';
import {pathcat} from 'pathcat';
import pkg from '../package.json' with {type: 'json'};

export type PickRequiredKeys<T> = {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

export type IfNeverThenUndefined<T> = [T] extends [never] ? undefined : T;
export type IfNoKeysThenUndefined<T> = [keyof T] extends [never] ? undefined : T;

export type MakeQueryUndefinedIfNoRequiredKeys<T> = [keyof T] extends [never]
	? undefined
	: [keyof PickRequiredKeys<T>] extends [never]
		? T | undefined
		: T;

export type RemoveOnlyUndefinedKeys<T> = {
	[K in keyof T as [T[K]] extends [undefined] ? never : K]: T[K];
};

export type UndefinedKeysToOptional<T> = {
	[K in keyof T as undefined extends T[K] ? K : never]?: T[K];
} & {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

export type IsExactly<T, A, True = true, False = false> = T extends A ? (A extends T ? True : False) : False;

export type AlwaysEnabledOptions = {
	signal?: AbortSignal | null | undefined;
	headers?: HeadersInit;
};

export type ExtractRouteParams<T extends string> = string extends T
	? string
	: T extends `${string}:${infer Param}/${infer Rest}`
		? Param | ExtractRouteParams<Rest>
		: T extends `${string}:${infer Param}`
			? Param
			: never;

export class KaitoClientHTTPError extends Error {
	constructor(
		public readonly request: Request,
		public readonly response: Response,
		public readonly body: ErroredAPIResponse,
	) {
		super(body.message);
	}
}

export type JSONIFY<T> = T extends {toJSON(...args: any): infer R}
	? R
	: T extends Record<string, unknown>
		? {[K in keyof T]: JSONIFY<T[K]>}
		: T extends Array<unknown>
			? Array<JSONIFY<T[number]>>
			: T;

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export interface KaitoHTTPClientRootOptions {
	/**
	 * The base URL for all API requests.
	 * All paths will be resolved relative to this URL.
	 *
	 * @example 'https://api.example.com'
	 */
	base: string;

	/**
	 * A function that is called before the request is made.
	 * Useful for adding headers, authentication, etc.
	 *
	 * @param url The URL to make the request to
	 * @param init The request init object
	 * @returns A Promise resolving to the modified Request object
	 *
	 * @example
	 * ```ts
	 * before: async (url, init) => {
	 *   const request = new Request(url, init);
	 *   request.headers.set('Authorization', 'Bearer token');
	 *   return request;
	 * }
	 * ```
	 */
	before?: (url: URL, init: RequestInit) => Promise<Request>;

	/**
	 * Custom fetch implementation to use instead of the global fetch.
	 * Useful for adding custom fetch behavior or using a different fetch implementation.
	 *
	 * @param request The Request object to fetch
	 * @returns A Promise resolving to the Response
	 *
	 * @example
	 * ```ts
	 * fetch: async (request) => {
	 *   const response = await customFetch(request);
	 *   return response;
	 * }
	 * ```
	 */
	fetch?: (request: Request) => Promise<Response>;
}

export class KaitoSSEStream<T extends SSEEvent<unknown, string>> implements AsyncIterable<T> {
	private readonly stream: ReadableStream<string>;

	// buffer needed because when reading from the stream,
	// we might receive a chunk that:
	// - Contains multiple complete events
	// - Contains partial events
	// - Cuts an event in the middle
	private buffer = '';

	public constructor(stream: ReadableStream<Uint8Array>) {
		this.stream = stream.pipeThrough(new TextDecoderStream());
	}

	private parseEvent(eventText: string): T | null {
		const lines = eventText.split('\n');
		const event: Partial<T> = {};

		for (const line of lines) {
			const colonIndex = line.indexOf(':');

			if (colonIndex === -1) {
				continue;
			}

			const field = line.slice(0, colonIndex).trim();
			const value = line.slice(colonIndex + 1).trim();

			switch (field) {
				case 'event':
					event.event = value;
					break;
				case 'data':
					event.data = JSON.parse(value) as T['data'];
					break;
				case 'id':
					event.id = value;
					break;
				case 'retry':
					event.retry = parseInt(value, 10);
					break;
			}
		}

		return 'data' in event ? (event as T) : null;
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
		for await (const chunk of this.stream) {
			this.buffer += chunk;
			const events = this.buffer.split('\n\n');
			this.buffer = events.pop() || '';

			for (const eventText of events) {
				const event = this.parseEvent(eventText);
				if (event) yield event;
			}
		}
	}

	/**
	 * Get the underlying stream for more advanced use cases
	 */
	public getStream() {
		return this.stream;
	}
}

export function createKaitoHTTPClient<APP extends Router<any, any, any> = never>(
	rootOptions: KaitoHTTPClientRootOptions,
) {
	type ROUTES = InferRoutes<APP>;

	type ReturnTypeFor<M extends KaitoMethod, Path extends Extract<ROUTES, {method: M}>['path']> = Awaited<
		ReturnType<Extract<ROUTES, {method: M; path: Path}>['run']>
	>;

	type RequestOptionsFor<M extends KaitoMethod, Path extends Extract<ROUTES, {method: M}>['path']> = {
		body: IfNeverThenUndefined<NonNullable<Extract<ROUTES, {method: M; path: Path}>['body']>['_input']>;

		params: IfNoKeysThenUndefined<Record<ExtractRouteParams<Path>, string>>;

		query: MakeQueryUndefinedIfNoRequiredKeys<
			Prettify<
				UndefinedKeysToOptional<{
					[Key in keyof NonNullable<Extract<ROUTES, {method: M; path: Path}>['query']>]: NonNullable<
						NonNullable<Extract<ROUTES, {method: M; path: Path}>['query']>[Key]
					>['_input'];
				}>
			>
		>;

		sse: IfNeverThenUndefined<ReturnTypeFor<M, Path> extends KaitoSSEResponse<any> ? true : never>;

		response: IfNeverThenUndefined<IsExactly<ReturnTypeFor<M, Path>, Response, true, never>>;
	};

	function* iterateHeaders(init: HeadersInit): Generator<[key: string, value: string], void, void> {
		for (const [key, value] of Array.isArray(init)
			? init
			: init instanceof Headers
				? init.entries()
				: Object.entries(init)) {
			yield [key, value];
		}
	}

	const create = <M extends KaitoMethod>(method: M) => {
		return async <Path extends Extract<ROUTES, {method: M}>['path']>(
			path: Path,
			...[options = {}]: [keyof PickRequiredKeys<RequestOptionsFor<M, Path>>] extends [never]
				? [options?: AlwaysEnabledOptions]
				: [options: RemoveOnlyUndefinedKeys<UndefinedKeysToOptional<RequestOptionsFor<M, Path>>> & AlwaysEnabledOptions]
		): Promise<
			Awaited<ReturnType<Extract<ROUTES, {method: M; path: Path}>['run']>> extends KaitoSSEResponse<
				infer U extends SSEEvent<unknown, string>
			>
				? KaitoSSEStream<U>
				: JSONIFY<Awaited<ReturnType<Extract<ROUTES, {method: M; path: Path}>['run']>>>
		> => {
			const params = (options as {params?: {}}).params ?? {};
			const query = (options as {query?: {}}).query ?? {};
			const body = (options as {body?: unknown}).body ?? undefined;

			const url = new URL(pathcat<string>(rootOptions.base, path, {...params, ...query}));

			const headers = new Headers({
				Accept: 'application/json',
			});

			if (typeof window === 'undefined' && !headers.has('User-Agent')) {
				headers.set('User-Agent', `kaito-http/client ${pkg.version}`);
			}

			const init: RequestInit = {
				headers,
				method,
			};

			if (options.headers !== undefined) {
				for (const [key, value] of iterateHeaders(options.headers)) {
					headers.set(key, value);
				}
			}

			if (options.signal !== undefined) {
				init.signal = options.signal;
			}

			if (body !== undefined) {
				headers.set('Content-Type', 'application/json');
				init.body = JSON.stringify(body);
			}

			const request = new Request(url, init);

			const response = await (rootOptions.fetch ?? fetch)(
				rootOptions.before ? await rootOptions.before(url, init) : request,
			);

			if (!response.ok) {
				if (response.headers.get('content-type')?.includes('application/json')) {
					// Try to assume non-ok responses are from `.onError()` and so therefore do have a body
					// but in the case we somehow got a non-ok response without a body, we'll just throw
					// an error with the status text and status code

					const json = await response.json().then(
						data => data as ErroredAPIResponse,
						() => null,
					);

					if (json) {
						throw new KaitoClientHTTPError(request, response, json);
					}
				}

				throw new KaitoClientHTTPError(request, response, {
					message: `Request to ${url} failed with status ${response.status} and no obvious body`,
					success: false,
					data: null,
				});
			}

			if ('response' in options && options.response) {
				return response as never;
			}

			if ('sse' in options && options.sse) {
				if (response.body === null) {
					throw new Error('Response body is null, so cannot stream');
				}

				return new KaitoSSEStream(response.body) as never;
			}

			const result = (await response.json()) as APIResponse<never>;

			if (!result.success) {
				// In theory success is always true because we've already checked the response status
				throw new KaitoClientHTTPError(request, response, result);
			}

			return result.data;
		};
	};

	return {
		get: create('GET'),
		post: create('POST'),
		put: create('PUT'),
		patch: create('PATCH'),
		delete: create('DELETE'),
		head: create('HEAD'),
		options: create('OPTIONS'),
	};
}

export function isKaitoClientHTTPError(error: unknown): error is KaitoClientHTTPError {
	return error instanceof KaitoClientHTTPError;
}
