import type {Router} from './router/router.ts';
import type {AnySchemaFor, BaseSchema, BaseSchemaDef, JSONValue} from './schema/schema.ts';
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

/**
 * Wraps BaseSchema to prevent the schema from participating in inference for `Output`.
 *
 * BaseSchema's `_output` is covariant (readonly), which means when both `run()` and the schema
 * compete to infer `ResultOutput`, TypeScript widens to the less specific type (e.g. `string`
 * instead of `"us-east-1"`). `NoInfer` ensures `Output` is only inferred from
 * `run()`, and the schema only checks against it via the contravariant `serialize` property.
 *
 * @see https://github.com/microsoft/TypeScript/issues/51756
 */
type OutputSchema<Output> = BaseSchema<any, any, any> & {serialize: (value: NoInfer<Output>) => JSONValue};

export type SSEOutputSpecWithSchema<Output> = {
	type: 'sse';
	schema: OutputSchema<Output>;
	summary?: string | undefined;
	description?: string | undefined;
};

export type SSEOutputSpecWithoutSchema = {
	type: 'sse';
	schema?: undefined;
	summary?: string | undefined;
	description?: string | undefined;
};

export type SSEOutputSpec<Output> = SSEOutputSpecWithSchema<Output> | SSEOutputSpecWithoutSchema;

export type JSONOutputSpec<Output> = {
	type: 'json';
	schema: OutputSchema<Output>;
	summary?: string | undefined;
	description?: string | undefined;
};

export type ResponseOutputSpec = {
	type: 'response';
	summary?: string | undefined;
	description?: string | undefined;
};

export type AnyOutputSpec = SSEOutputSpec<any> | JSONOutputSpec<any> | ResponseOutputSpec;

export type OpenAPISpecFor<ResultOutput> = [ResultOutput] extends [never]
	? AnyOutputSpec
	: [ResultOutput] extends [KaitoSSEResponse<infer Event>]
		? Event extends SSEEvent<infer U, any>
			? [U] extends [JSONValue]
				? SSEOutputSpec<Event>
				: SSEOutputSpecWithSchema<Event>
			: SSEOutputSpec<any>
		: [ResultOutput] extends [Response]
			? ResponseOutputSpec
			: JSONOutputSpec<ResultOutput>;

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
	BodyInput extends JSONValue,
	BodyOutput,
> = {
	body?: BaseSchema<BodyInput, BodyOutput, BaseSchemaDef<BodyInput>>;
	query?: {[Key in keyof Query]: AnySchemaFor<Query[Key]>};
	path: Path;
	method: Method;
	openapi?: AnyOutputSpec;
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
	unknown,
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
	any
>;
