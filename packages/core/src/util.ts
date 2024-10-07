import {parse as parseContentType} from 'content-type';
import type {HTTPMethod} from 'find-my-way';
import {Readable} from 'node:stream';
import {json} from 'node:stream/consumers';
import getRawBody from 'raw-body';
import type {KaitoRequest} from './req.ts';
import type {KaitoResponse} from './res.ts';
import {Router} from './router.ts';

export type ExtractRouteParams<T extends string> = string extends T
	? Record<string, string>
	: T extends `${string}:${infer Param}/${infer Rest}`
		? {[k in Param | keyof ExtractRouteParams<Rest>]: string}
		: T extends `${string}:${infer Param}`
			? {[k in Param]: string}
			: {};

export type KaitoMethod = HTTPMethod | '*';

export type GetContext<Result> = (req: KaitoRequest, res: KaitoResponse) => Promise<Result>;

/**
 * @deprecated use `createUtilities` instead
 */
export function createGetContext<Context>(callback: GetContext<Context>): GetContext<Context> {
	return callback;
}

/**
 * A helper function to create typed necessary functions
 *
 * @example
 * ```ts
 * const {router, getContext} = createUtilities(async (req, res) => {
 *   // Return context here
 * })
 *
 * const app = router().get('/', async () => "hello");
 *
 * const server = createServer({
 *   router: app,
 *   getContext,
 *   // ...
 * });
 * ```
 */
export function createUtilities<Context>(getContext: GetContext<Context>): {
	getContext: GetContext<Context>;
	router: () => Router<Context, Context, never>;
} {
	return {
		getContext,
		router: () => Router.create<Context>(),
	};
}

export type InferContext<T> = T extends (req: KaitoRequest, res: KaitoResponse) => Promise<infer U> ? U : never;

export function getLastEntryInMultiHeaderValue(headerValue: string | string[]): string {
	const normalized = Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
	const lastIndex = normalized.lastIndexOf(',');

	return lastIndex === -1 ? normalized.trim() : normalized.slice(lastIndex + 1).trim();
}

export interface Parsable<Output = any, Input = Output> {
	_input: Input;
	parse: (value: unknown) => Output;
}

export type InferParsable<T> =
	T extends Parsable<infer Output, infer Input>
		? {
				input: Input;
				output: Output;
			}
		: never;

export function parsable<T>(parse: (value: unknown) => T): Parsable<T, T> {
	return {
		parse,
	} as Parsable<T, T>;
}

export type RemoveEndSlashes<T extends string> = T extends `${infer U}/` ? U : T;
export type AddStartSlashes<T extends string> = T extends `/${infer U}` ? `/${U}` : `/${T}`;
export type NormalizePath<T extends string> = AddStartSlashes<RemoveEndSlashes<T>>;
export type Values<T> = T[keyof T];
export type NoEmpty<T> = [keyof T] extends [never] ? never : T;

export async function getBody(req: KaitoRequest): Promise<unknown> {
	if (!req.headers['content-type']) {
		return null;
	}

	const buffer = await getRawBody(req.raw);

	const {type} = parseContentType(req.headers['content-type']);

	switch (type) {
		case 'application/json': {
			return json(Readable.from(buffer));
		}

		default: {
			if (process.env.NODE_ENV === 'development') {
				console.warn('[kaito] Unsupported content type:', type);
				console.warn('[kaito] This message is only shown in development mode.');
			}

			return null;
		}
	}
}
