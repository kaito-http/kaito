import type {KaitoRequest} from './request.ts';
import type {KaitoResponse} from './response.ts';
import {Router} from './router/router.ts';

export type ErroredAPIResponse = {success: false; data: null; message: string};
export type SuccessfulAPIResponse<T> = {success: true; data: T; message: 'OK'};
export type APIResponse<T> = ErroredAPIResponse | SuccessfulAPIResponse<T>;
export type AnyResponse = APIResponse<unknown>;
export type MakeOptional<T, K extends keyof T> = T extends T ? Omit<T, K> & Partial<Pick<T, K>> : never;

export type ExtractRouteParams<T extends string> = string extends T
	? Record<string, string>
	: T extends `${string}:${infer Param}/${infer Rest}`
		? {[k in Param | keyof ExtractRouteParams<Rest>]: string}
		: T extends `${string}:${infer Param}`
			? {[k in Param]: string}
			: {};

export type GetContext<Result> = (req: KaitoRequest, res: KaitoResponse) => Promise<Result>;

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
 * const server = createKaitoHandler({
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
