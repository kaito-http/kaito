import type {KaitoHead} from './head.ts';
import type {KaitoRequest} from './request.ts';
import {Router} from './router/router.ts';

/**
 * A helper to check if the environment is Node.js-like and the NODE_ENV is development
 */
export const isNodeLikeDev =
	typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env.NODE_ENV === 'development';

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

/**
 * A function that is called to get the context for a request.
 *
 * This is useful for things like authentication, to pass in a database connection, etc.
 *
 * It's fine for this function to throw; if it does, the error is passed to the `onError` function.
 *
 * @param req - The kaito request object, which contains the request method, url, headers, etc
 * @param head - The kaito head object, which contains getters and setters for headers and status
 * @returns The context for your routes
 */
export type GetContext<Result> = (req: KaitoRequest, head: KaitoHead) => Promise<Result>;

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
