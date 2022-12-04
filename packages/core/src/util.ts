import {parse as parseContentType} from 'content-type';
import type {HTTPMethod} from 'find-my-way';
import {Readable} from 'node:stream';
import {json} from 'node:stream/consumers';
import getRawBody from 'raw-body';
import type {KaitoRequest} from './req';
import type {KaitoResponse} from './res';

export type ExtractRouteParams<T extends string> = string extends T
	? Record<string, string>
	: T extends `${string}:${infer Param}/${infer Rest}`
	? {[k in Param | keyof ExtractRouteParams<Rest>]: string}
	: T extends `${string}:${infer Param}`
	? {[k in Param]: string}
	: {};

export type KaitoMethod = HTTPMethod | '*';

export type GetContext<Result> = (req: KaitoRequest, res: KaitoResponse) => Promise<Result>;

export function createGetContext<Context>(callback: GetContext<Context>) {
	return callback;
}

export type PartialExcept<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;

export type InferContext<T> = T extends (req: KaitoRequest, res: KaitoResponse) => Promise<infer U> ? U : never;

export function getLastEntryInMultiHeaderValue(headerValue: string | string[]) {
	const normalized = Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
	const lastIndex = normalized.lastIndexOf(',');

	return lastIndex === -1 ? normalized.trim() : normalized.slice(lastIndex + 1).trim();
}

type RemoveEndSlashes<T extends string> = T extends `${infer U}/` ? U : T;
type AddStartSlashes<T extends string> = T extends `/${infer U}` ? `/${U}` : `/${T}`;
export type NormalizePath<T extends string> = AddStartSlashes<RemoveEndSlashes<T>>;
export type Values<T> = T[keyof T];
export type NoEmpty<T> = [keyof T] extends [never] ? never : T;

export async function getBody(req: KaitoRequest) {
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
