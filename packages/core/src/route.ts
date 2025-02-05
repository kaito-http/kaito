import type {z} from 'zod';
import type {KaitoMethod} from './router/types.ts';
import type {KaitoSSEResponse} from './stream/stream.ts';
import type {ExtractRouteParams} from './util.ts';

export type RouteRunData<Path extends string, Context, QueryOutput, BodyOutput> = {
	ctx: Context;
	body: BodyOutput;
	query: QueryOutput;
	params: ExtractRouteParams<Path>;
};

export type AnyQuery = {[key in string]: any};

export type Through<From, To> = (context: From) => Promise<To>;

export type SSEOutputSpec<Result> = {
	type: 'sse';
	schema: z.Schema<Result>;
	description?: string;
};

export type JSONOutputSpec<Result> = {
	type: 'json';
	schema: z.Schema<Result>;
	description?: string;
};

export type OutputSpec<Result> = {
	description?: string;
	body: NoInfer<Result extends KaitoSSEResponse<infer R> ? SSEOutputSpec<R> : JSONOutputSpec<Result>>;
};

export type Route<
	// Router context
	ContextTo,
	// Route information
	Result,
	Path extends string,
	Method extends KaitoMethod,
	// Schemas
	Query,
	Body,
> = {
	through: Through<unknown, ContextTo>;
	body?: z.Schema<Body>;
	query?: {[Key in keyof Query]: z.Schema<Query[Key]>};
	path: Path;
	method: Method;
	openapi?: OutputSpec<NoInfer<Result>>;
	run(data: RouteRunData<Path, ContextTo, Query, Body>): Promise<Result> | Result;
};

export type AnyRoute = Route<any, any, any, any, any, any>;
