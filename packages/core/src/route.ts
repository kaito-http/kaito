import type {Router} from './router/router.ts';
import type {AnySchemaFor, BaseSchema, BaseSchemaDef, JSONValue} from './schema/schema.ts';
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
	description?: string | undefined;
};

export type JSONOutputSpec<ResultInput, ResultOutput extends JSONValue> = {
	type: 'json';
	schema: BaseSchema<ResultOutput, ResultInput, BaseSchemaDef<ResultOutput>>;
	description?: string | undefined;
};

export type OutputSpec<ResultInput, ResultOutput> =
	ResultInput extends KaitoSSEResponse<infer R>
		? SSEOutputSpec<Extract<R, JSONValue>> & {
				description?: string;
			}
		: JSONOutputSpec<ResultOutput, Extract<ResultInput, JSONValue>> & {
				description?: string;
			};

export type Route<
	// Router context
	ContextFrom,
	ContextTo,
	RouterInput extends readonly unknown[],
	// Result information
	ResultInput,
	ResultOutput,
	//Route information
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
	openapi?: OutputSpec<ResultInput, ResultOutput>;
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
	// ResultInput
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
	// Body
	any
>;
