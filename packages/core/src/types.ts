import {AnyZodObject, infer as ZodInfer} from 'zod';

export type EmptyObject = Record<string, never>;

export type ExtractRouteParams<T extends string> = string extends T
	? Record<string, string>
	: T extends `${string}:${infer Param}/${infer Rest}`
	? Record<Param | keyof ExtractRouteParams<Rest>, string>
	: T extends `${string}:${infer Param}`
	? Record<Param, string>
	: EmptyObject;

export type Context<
	Path extends string,
	Body extends AnyZodObject,
	Query extends AnyZodObject
> = {
	params: ExtractRouteParams<Path>;
	body: ZodInfer<Body>;
	query: ZodInfer<Query>;
};

export const enum Method {
	GET = 'get',
	POST = 'post',
	DELETE = 'delete',
	PUT = 'put',
	PATCH = 'patch',
}
