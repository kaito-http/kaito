import type {Router} from './router/router.ts';
import type {AnySchemaFor, BaseSchema, JSONValue} from './schema/schema.ts';
import type {KaitoSSEResponse, SSEEvent} from './stream/stream.ts';
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

export type SSEOutputSpecWithSchema = {
	type: 'sse';
	schema: BaseSchema<any, any, any>;
	description?: string | undefined;
};

export type SSEOutputSpecWithoutSchema = {
	type: 'sse';
	schema?: undefined;
	description?: string | undefined;
};

export type SSEOutputSpec = SSEOutputSpecWithSchema | SSEOutputSpecWithoutSchema;

export type JSONOutputSpec = {
	type: 'json';
	schema: BaseSchema<any, any, any>;
	description?: string | undefined;
};

export type ResponseOutputSpec = {
	type: 'response';
	description?: string | undefined;
};

export type OutputSpec = SSEOutputSpec | JSONOutputSpec | ResponseOutputSpec;

export type OpenAPISpec<Body extends OutputSpec = OutputSpec> = {
	summary?: string;
	description?: string;
	body: Body;
};

export type OpenAPISpecFor<ResultOutput> = 0 extends 1 & ResultOutput
	? OpenAPISpec
	: [ResultOutput] extends [never]
		? OpenAPISpec
		: [ResultOutput] extends [KaitoSSEResponse<any>]
			? [ResultOutput extends KaitoSSEResponse<SSEEvent<infer U, any>> ? U : never] extends [JSONValue]
				? OpenAPISpec<SSEOutputSpec>
				: OpenAPISpec<SSEOutputSpecWithSchema>
			: [ResultOutput] extends [Response]
				? OpenAPISpec<ResponseOutputSpec>
				: OpenAPISpec<JSONOutputSpec>;

export type Route<
	// Router context
	ContextFrom,
	ContextTo,
	RouterInput extends readonly unknown[],
	// Result information
	ResultOutput,
	//Route information
	Path extends string,
	AdditionalParams extends string,
	Method extends KaitoMethod,
	// Schemas
	Query extends Record<string, JSONValue>,
	Body,
> = {
	body?: BaseSchema<any, Body, any>;
	query?: {[Key in keyof Query]: AnySchemaFor<Query[Key]>};
	path: Path;
	method: Method;
	openapi?: OpenAPISpec;
	router: Router<ContextFrom, ContextTo, AdditionalParams, AnyRoute, RouterInput>;
	run(
		data: RouteRunData<ExtractRouteParams<Path> | AdditionalParams, ContextTo, Query, Body>,
	): Promise<ResultOutput> | ResultOutput;
};

// TODO: This type has caused us so many fucking issues to do with
// assignability. We should really remove lots of other code to be using `never`
// more sparingly, or remove usage of AnyRoute or refactor it in a way that
// doesn't make it so awkward to use.
export type AnyRoute = Route<
	// ContextFrom
	any,
	// ContextTo
	any,
	// RouterInput
	any,
	// ResultOutput
	unknown,
	// Path
	any,
	// AdditionalParams
	any,
	// Method
	any,
	// Query
	any,
	// Body
	any
>;
