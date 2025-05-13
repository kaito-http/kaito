import type {KaitoHead} from './head.ts';
import type {KaitoRequest} from './request.ts';
import type {AnyRoute} from './route.ts';
import type {Router} from './router/router.ts';

/**
 * A helper to check if the environment is Node.js-like and the `NODE_ENV` environment variable is set to `'development'`
 */
export const isNodeLikeDev =
	typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env.NODE_ENV === 'development';

export type ErroredAPIResponse = {success: false; data: null; message: string};
export type SuccessfulAPIResponse<T> = {success: true; data: T};
export type APIResponse<T> = ErroredAPIResponse | SuccessfulAPIResponse<T>;
export type AnyResponse = APIResponse<unknown>;
export type MakeOptional<T, K extends keyof T> = T extends T ? Omit<T, K> & Partial<Pick<T, K>> : never;
export type MaybePromise<T> = T | Promise<T>;
export type KaitoMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type NotReadonly<T> = {
	-readonly [K in keyof T]: T[K];
};

export type ExtractRouteParams<T extends string> = string extends T
	? string
	: T extends `${string}:${infer Param}/${infer Rest}`
		? Param | ExtractRouteParams<Rest>
		: T extends `${string}:${infer Param}`
			? Param
			: never;

/**
 * Accepts a router instance, and returns a union of all the routes in the router
 *
 * @example
 * ```ts
 * const app = router.get('/', () => 'Hello, world!');
 *
 * type Routes = InferRoutes<typeof app>;
 * ```
 */
export type InferRoutes<R extends Router<never, never, never, never, never>> =
	R extends Router<any, any, any, infer R extends AnyRoute, any> ? R : never;

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
export type GetContext<Result, Input extends readonly unknown[]> = (
	req: KaitoRequest,
	head: KaitoHead,
	...args: Input
) => MaybePromise<Result>;
