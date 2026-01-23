import type {Router} from './router/router.ts';
import type {AnySchemaFor, BaseSchema, JSONValue} from './schema/schema.ts';
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

export type SSEOutputSpec = {
	type: 'sse';
	description?: string | undefined;
};

export type JSONOutputSpec<SchemaInput extends JSONValue = JSONValue, SchemaOutput = any> = {
	type: 'json';
	schema: BaseSchema<SchemaInput, SchemaOutput, any>;
	description?: string | undefined;
};

export type OutputSpec = SSEOutputSpec | JSONOutputSpec;

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
	// Schemas - BodyInput is wire format, BodyOutput is parsed server format
	Query extends Record<string, JSONValue>,
	BodyInput extends JSONValue,
	BodyOutput,
	// OpenAPI spec - preserves the actual schema types
	OpenAPI extends OutputSpec | undefined = OutputSpec | undefined,
> = {
	body?: BaseSchema<BodyInput, BodyOutput, any>;
	query?: {[Key in keyof Query]: AnySchemaFor<Query[Key]>};
	path: Path;
	method: Method;
	openapi?: OpenAPI;
	router: Router<ContextFrom, ContextTo, AdditionalParams, AnyRoute, RouterInput>;
	run(
		data: RouteRunData<ExtractRouteParams<Path> | AdditionalParams, ContextTo, Query, BodyOutput>,
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
	any,
	// Path
	any,
	// AdditionalParams
	any,
	// Method
	any,
	// Query
	any,
	// BodyInput
	any,
	// BodyOutput
	any,
	// OpenAPI
	any
>;
