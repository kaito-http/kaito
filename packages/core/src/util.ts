import type {KaitoRequest} from './request.ts';
import {Router} from './router/router.ts';

export type ErroredAPIResponse = {success: false; data: null; message: string};
export type SuccessfulAPIResponse<T> = {success: true; data: T; message: 'OK'};
export type APIResponse<T> = ErroredAPIResponse | SuccessfulAPIResponse<T>;
export type AnyResponse = APIResponse<unknown>;

export type ExtractRouteParams<T extends string> = string extends T
	? Record<string, string>
	: T extends `${string}:${infer Param}/${infer Rest}`
		? {[k in Param | keyof ExtractRouteParams<Rest>]: string}
		: T extends `${string}:${infer Param}`
			? {[k in Param]: string}
			: {};

export type GetContext<Result> = (req: KaitoRequest) => Promise<Result>;

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
