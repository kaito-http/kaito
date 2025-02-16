import type {z} from 'zod';
import type {Router} from './router/router.ts';
import type {KaitoSSEResponse} from './stream/stream.ts';
import type {ExtractRouteParams, KaitoMethod} from './util.ts';

export type RouteRunData<Params, Context, QueryOutput, BodyOutput> = {
	ctx: Context;
	body: BodyOutput;
	query: QueryOutput;
	params: Params;
};

export type AnyQuery = {[key in string]: any};

export type Through<From, To, RequiredParams extends Record<string, unknown>> = (
	context: From,
	params: RequiredParams,
) => Promise<To>;

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
	AdditionalParams extends Record<string, unknown>,
	Method extends KaitoMethod,
	// Schemas
	Query,
	Body,
> = {
	body?: z.Schema<Body>;
	query?: {[Key in keyof Query]: z.Schema<Query[Key]>};
	path: Path;
	method: Method;
	openapi?: OutputSpec<NoInfer<Result>>;
	router: Router<unknown, ContextTo, AdditionalParams, AnyRoute>;
	run(
		data: RouteRunData<ExtractRouteParams<Path> & AdditionalParams, ContextTo, Query, Body>,
	): Promise<Result> | Result;
};

export type AnyRoute = Route<any, any, any, any, any, any, any>;
