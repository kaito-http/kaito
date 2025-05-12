import type {Router} from './router/router.ts';
import type {AnySchemaFor, JSONValue} from './schema/schema.ts';
import type {KaitoSSEResponse} from './stream/stream.ts';
import type {ExtractRouteParams, KaitoMethod} from './util.ts';

export type RouteRunData<Params extends string, Context, QueryOutput, BodyOutput> = {
	params: Record<Params, string>;
	ctx: Context;
	query: QueryOutput;
	body: BodyOutput;
};

export type AnyQuery = {[key in string]: any};

export type Through<From, To, RequiredParams extends string> = (
	context: From,
	params: Record<RequiredParams, string>,
) => Promise<To>;

export type SSEOutputSpec<Result extends JSONValue> = {
	type: 'sse';
	schema: AnySchemaFor<Result>;
	description?: string;
};

export type JSONOutputSpec<Result extends JSONValue> = {
	type: 'json';
	schema: AnySchemaFor<Result>;
	description?: string;
};

export type OutputSpec<Result extends JSONValue> = {
	description?: string;
	body: NoInfer<
		Result extends KaitoSSEResponse<infer R> ? SSEOutputSpec<Extract<R, JSONValue>> : JSONOutputSpec<Result>
	>;
};

export type Route<
	// Router context
	ContextTo,
	// Route information
	Result extends JSONValue,
	Path extends string,
	AdditionalParams extends string,
	Method extends KaitoMethod,
	// Schemas
	Query extends Record<string, JSONValue>,
	Body extends JSONValue,
> = {
	body?: AnySchemaFor<Body>;
	query?: {[Key in keyof Query]: AnySchemaFor<Query[Key]>};
	path: Path;
	method: Method;
	openapi?: OutputSpec<NoInfer<Result>>;
	router: Router<unknown, ContextTo, AdditionalParams, AnyRoute, any>;
	run(
		data: RouteRunData<ExtractRouteParams<Path> | AdditionalParams, ContextTo, Query, Body>,
	): Promise<Result> | Result;
};

export type AnyRoute = Route<any, any, any, any, any, any, any>;
