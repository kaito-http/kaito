/* eslint-disable arrow-body-style */
import type {APIResponse, ErroredAPIResponse, KaitoMethod, Router} from '@kaito-http/core';
import {pathcat} from 'pathcat';
import pkg from '../package.json';

export type IfNeverThen<T, A = undefined> = [T] extends [never] ? A : T;
export type IfNoKeysThen<T, A = undefined> = [keyof T] extends [never] ? A : T;

export type OptionalUndefinedValues<T> = {
	[K in keyof T as T[K] extends undefined ? never : K]: T[K];
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
		public readonly body: ErroredAPIResponse
	) {
		super(body.message);
	}
}

export function createAPIClient<APP extends Router<never, never, never> = never>(rootOptions: {base: string}) {
	type RequestOptionsFor<M extends KaitoMethod, Path extends Extract<APP['routes'][number], {method: M}>['path']> = {
		body: IfNeverThen<NonNullable<Extract<APP['routes'][number], {method: M; path: Path}>['body']>['_input']>;

		params: IfNoKeysThen<
			Record<ExtractRouteParams<Path>, string> & {
				[Key in keyof NonNullable<Extract<APP['routes'][number], {method: M; path: Path}>['query']>]: NonNullable<
					Extract<APP['routes'][number], {method: M; path: Path}>['query']
				>[Key]['_input'];
			}
		>;
	};

	type AlwaysEnabledOptions = {
		signal?: AbortSignal | null | undefined;
	};

	const create = <M extends KaitoMethod>(method: M) => {
		return async <Path extends Extract<APP['routes'][number], {method: M}>['path']>(
			path: Path,
			...[options = {}]: [keyof OptionalUndefinedValues<RequestOptionsFor<M, Path>>] extends [never]
				? [options?: AlwaysEnabledOptions]
				: [options: OptionalUndefinedValues<RequestOptionsFor<M, Path>> & AlwaysEnabledOptions]
		): Promise<Awaited<ReturnType<Extract<APP['routes'][number], {method: M; path: Path}>['run']>>> => {
			const params = (options as {params?: {}}).params ?? {};
			const body = (options as {body?: unknown}).body ?? undefined;

			const url = pathcat<string>(rootOptions.base, path, params);

			const headers = new Headers({
				Accept: 'application/json',
			});

			if (body !== undefined) {
				headers.set('Content-Type', 'application/json');
			}

			if (typeof window === 'undefined' && !headers.has('User-Agent')) {
				headers.set('User-Agent', `kaito-http/client ${pkg.version}`);
			}

			const init: RequestInit = {
				headers,
				method,
				credentials: 'include',
			};

			if (body !== undefined) {
				init.body = JSON.stringify(body);
			}

			if (options.signal !== undefined) {
				init.signal = options.signal;
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
	fallbackErrorMessage: ((error: unknown) => string) | string = 'Something went wrong'
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
