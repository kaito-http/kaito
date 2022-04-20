import type {
	APIResponse,
	ExtractRouteParams,
	HTTPMethod,
	KaitoError,
	Route,
	Router,
	RoutesInit,
	SuccessfulAPIResponse,
} from '@kaito-http/core';
import type {z} from 'zod';
import urlcat from 'urlcat';

export type AnyRouter = Router<unknown, RoutesInit<unknown>>;

export type ExtractRoute<
	R extends AnyRouter,
	M extends HTTPMethod,
	P extends keyof R['routes']
> = R['routes'][P] extends Route<infer Result, infer Path, infer Method, infer Context, infer Input>
	? Extract<
			{
				result: Result;
				path: Path;
				method: Method;
				context: Context;
				input: NonNullable<Input>;
			},
			{
				method: M;
			}
	  >
	: never;

type PickTruthyKeys<T> = {
	[K in keyof T as [T[K]] extends [never] ? never : K]: T[K];
};

type IsEmpty<T> = [keyof T] extends [never] ? true : false;

export type ExtractInput<R extends AnyRouter, M extends HTTPMethod, P extends keyof R['routes']> = ExtractRoute<
	R,
	M,
	P
>['input'] extends z.ZodSchema<unknown, z.ZodTypeDef, infer Input>
	? Input
	: never;

export type RequestParamsInput<
	R extends AnyRouter,
	M extends HTTPMethod,
	P extends keyof R['routes']
> = PickTruthyKeys<{
	input: ExtractInput<R, M, P>;
	params: ExtractRouteParams<ExtractRoute<R, M, P>['path']>;
}>;

class KaitoClientError extends Error implements KaitoError {
	constructor(public readonly status: number, message: string) {
		super(message);
	}
}

export function isSuccess<T>(response: Response, body: APIResponse<T>): body is SuccessfulAPIResponse<T> {
	if (response.status >= 400 || !body.message) {
		return false;
	}

	return true;
}

export function createClient<R extends AnyRouter>(baseUrl: string, init?: RequestInit) {
	return {
		async fetch<M extends HTTPMethod, Path extends Extract<keyof R['routes'], string>>(
			...[method, path, options, localInit = {}]: IsEmpty<RequestParamsInput<R, M, Path>> extends true
				? [method: M, path: Path, localInit?: RequestInit]
				: [method: M, path: Path, options: RequestParamsInput<R, M, Path>, localInit?: RequestInit]
		) {
			const {params = {}, input} = options as {
				params?: Record<string, string>;
				input?: ExtractInput<R, M, Path>;
			};

			const url = urlcat(
				baseUrl,
				path,
				input && method === 'GET'
					? {
							...params,
							input: JSON.stringify(input),
					  }
					: params
			);

			const headers = new Headers({
				...init?.headers,
				...localInit?.headers,
			});

			if (method !== 'GET' && input) {
				headers.set('Content-Type', 'application/json');
			}

			const response = await fetch(url, {
				...init,
				...localInit,
				method,
				headers,
				body: method === 'GET' ? undefined : JSON.stringify(input),
			});

			const body = (await response.json()) as APIResponse<ExtractRoute<R, M, Path>['result']>;

			if (!isSuccess(response, body)) {
				throw new KaitoClientError(response.status, body.message);
			}

			return body.data;
		},
	};
}
