import type {APIResponse, ErroredAPIResponse, InferParsable, InferRoutes, KaitoMethod, Router} from '@kaito-http/core';
import {pathcat} from 'pathcat';
import pkg from '../package.json';

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

export type AlwaysEnabledOptions = {
	signal?: AbortSignal | null | undefined;
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

export type JSONIFY<T> = T extends Date
	? string
	: T extends Record<string, unknown>
		? {[K in keyof T]: JSONIFY<T[K]>}
		: T extends Array<unknown>
			? Array<JSONIFY<T[number]>>
			: T;

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export interface KaitoHTTPClientRootOptions {
	base: string;
}

export function createKaitoHTTPClient<APP extends Router<any, any, any> = never>(
	rootOptions: KaitoHTTPClientRootOptions,
) {
	type ROUTES = InferRoutes<APP>;

	type RequestOptionsFor<M extends KaitoMethod, Path extends Extract<ROUTES, {method: M}>['path']> = {
		body: IfNeverThenUndefined<InferParsable<NonNullable<Extract<ROUTES, {method: M; path: Path}>['body']>>['input']>;

		params: IfNoKeysThenUndefined<Record<ExtractRouteParams<Path>, string>>;

		query: MakeQueryUndefinedIfNoRequiredKeys<
			Prettify<
				UndefinedKeysToOptional<{
					[Key in keyof NonNullable<Extract<ROUTES, {method: M; path: Path}>['query']>]: InferParsable<
						NonNullable<Extract<ROUTES, {method: M; path: Path}>['query']>[Key]
					>['input'];
				}>
			>
		>;
	};

	const create = <M extends KaitoMethod>(method: M) => {
		return async <Path extends Extract<ROUTES, {method: M}>['path']>(
			path: Path,
			...[options = {}]: [keyof PickRequiredKeys<RequestOptionsFor<M, Path>>] extends [never]
				? [options?: AlwaysEnabledOptions]
				: [options: RemoveOnlyUndefinedKeys<UndefinedKeysToOptional<RequestOptionsFor<M, Path>>> & AlwaysEnabledOptions]
		): Promise<JSONIFY<Awaited<ReturnType<Extract<ROUTES, {method: M; path: Path}>['run']>>>> => {
			const params = (options as {params?: {}}).params ?? {};
			const query = (options as {query?: {}}).query ?? {};
			const body = (options as {body?: unknown}).body ?? undefined;

			const url = pathcat<string>(rootOptions.base, path, {...params, ...query});

			const headers = new Headers({
				Accept: 'application/json',
			});

			if (typeof window === 'undefined' && !headers.has('User-Agent')) {
				headers.set('User-Agent', `kaito-http/client ${pkg.version}`);
			}

			const init: RequestInit = {
				headers,
				method,
				credentials: 'include',
			};

			if (options.signal !== undefined) {
				init.signal = options.signal;
			}

			if (body !== undefined) {
				headers.set('Content-Type', 'application/json');
				init.body = JSON.stringify(body);
			}

			const request = new Request(url, init);

			const response = await fetch(request);

			const result = (await response.json()) as APIResponse<never>;

			if (!result.success) {
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

export async function safe<T>(
	promise: Promise<T>,
	fallbackErrorMessage: ((error: unknown) => string) | string = 'Something went wrong',
): Promise<
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: unknown;
			message: string;
	  }
> {
	return promise
		.then(res => ({success: true as const, data: res}))
		.catch((error: unknown) => {
			if (error instanceof KaitoClientHTTPError) {
				return {
					success: false as const,
					error,
					message: error.message,
				};
			}

			console.warn(error);

			const message = typeof fallbackErrorMessage === 'function' ? fallbackErrorMessage(error) : fallbackErrorMessage;

			return {
				success: false as const,
				error,
				message,
			};
		});
}
